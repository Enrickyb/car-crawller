const axios = require('axios');
const cheerio = require('cheerio');
const { Client } = require('pg');
const UUID = require('uuid');
// Configurações do banco de dados PostgreSQL
const client = new Client({
    user: 'tcar',
    host: 'localhost',
    database: 'cardb',
    password: 'postgres',
    port: 5434,
});

// Função para conectar ao banco de dados
async function connectDB() {
    await client.connect();
    console.log('Conectado ao banco de dados');
}

// Função para criar a tabela se não existir
async function createTable() {
    const query = `
    CREATE TABLE IF NOT EXISTS brands (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE
    );
  `;
    await client.query(query);
    console.log('Tabela criada (se não existia)');
}

// Função para salvar uma marca no banco de dados
async function saveBrand(name, logo_url, models, in_production, discontinued) {
    const query = 'INSERT INTO brand (id, name, logo_url, models, isProduction, discontinued) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING';
    const id = UUID.v4();
    const values = [id, name, logo_url, models_url, in_production, discontinued];
    await client.query(query, values);
    console.log(`Marca ${name} salva no banco de dados`);

}

// Função principal para fazer o scraping e salvar os dados
async function main() {
    await connectDB();
    const url = 'https://www.autoevolution.com/cars/';

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        let carData = [];
        $('.bcol-white.carman').each((index, element) => {
            const brandName = $(element).find('h5 a span').text().trim();
            const logoUrl = $(element).find('a img').attr('src');
            const models = $(element).find('.models a').map((i, el) => $(el).text().trim()).get();
            const inProduction = $(element).next('.carnums').find('p .col-green2').text().trim();
            const discontinued = $(element).next('.carnums').find('p .col-red').text().trim();

            carData.push({
                brand: brandName,
                logo: logoUrl,
                models: models,
                inProduction: parseInt(inProduction, 10),
                discontinued: parseInt(discontinued, 10)
            });
        });

        console.log(carData[1]);

        await Promise.all(carData.map(async (car) => {
            await saveBrand(car.brand, car.logo, car.models, car.inProduction, car.discontinued);
        }));
    } catch (error) {
        console.error('Erro ao fazer scraping:', error);
    } finally {
        await client.end();
        console.log('Conexão com o banco de dados fechada');
    }
}

main();
