const axios = require('axios');
const cheerio = require('cheerio');
const { Client } = require('pg');
const UUID = require('uuid');
const fs = require('fs');

// Configurações do banco de dados PostgreSQL
const client = new Client({
    user: 'cardb',
    host: '172.18.0.2',
    database: 'cardb',
    password: 'cardb',
    port: 5432,
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
async function carExists(name) {
    const query = 'SELECT id FROM cars WHERE name = $1';
    const result = await client.query(query, [name]);
    return result.rowCount > 0;
}

async function saveCarData(carData) {

    const query = `
    INSERT INTO cars (
        id, name, description_title, description, production_years, cylinders, displacement, engine_power, torque, 
        fuel_system, fuel, fuel_capacity, drive_type, gearbox, break_front, break_back, tire_size, 
        dimension_length, width, height, front_rear_track, whellbase, ground_clearance, cargo_volume, 
        aerodynamics, unladen_weight, fuel_economy_city, fuel_economy_highway, fuel_economy_combined, brand_id
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 
        $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
    )
  `;
    const values = [
        UUID.v4(), carData.name, carData.description_title, carData.description, carData.production_years,
        carData.cylinders, carData.displacement, carData.engine_power, carData.torque, carData.fuel_system,
        carData.fuel, carData.fuel_capacity, carData.drive_type, carData.gearbox, carData.brake_front,
        carData.brake_back, carData.tire_size, carData.dimension_length, carData.width, carData.height,
        carData.front_rear_track, carData.wheelbase, carData.ground_clearance, carData.cargo_volume,
        carData.aerodynamics, carData.unladen_weight, carData.fuel_economy_city, carData.fuel_economy_highway,
        carData.fuel_economy_combined, carData.brand_id
    ];
    await client.query(query, values);
    console.log(`Dados do carro ${carData.name} salvos no banco de dados`);
}


// Função para buscar o ID de uma marca pelo nome
async function getBrandId(name) {
    const query = 'SELECT id FROM brand WHERE name = $1';
    const result = await client.query(query, [name]);
    if (result.rows.length > 0) {
        return result.rows[0].id;
    } else {
        throw new Error(`Marca "${name}" não encontrada`);
    }
}

const checkpointPath = './checkpoint.txt';

function getCheckpoint() {
    if (fs.existsSync(checkpointPath)) {
        const data = fs.readFileSync(checkpointPath, 'utf8');
        return parseInt(data, 10);
    }
    return 0;
}

function setCheckpoint(index) {
    fs.writeFileSync(checkpointPath, index.toString());
}

// Função principal para fazer o scraping e salvar os dados
async function main() {
    await connectDB();
    const url = 'https://www.autoevolution.com/cars/';
    const startIndex = getCheckpoint();
    const limit = 100; // Define o limite de páginas para acessar

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        let carData = [];
        $('.bcol-white.carman').each((index, element) => {
            if (index < startIndex) return; // Pula as páginas já processadas

            const brandUrl = $(element).find('h5 a').attr('href');

            if (brandUrl) {
                carData.push({
                    brandUrl
                });
            }

            if (carData.length >= limit) {
                setCheckpoint(index + 1); // Atualiza o checkpoint
                return false; // Para o loop
            }
        });

        console.log(carData);
        for (let car of carData) {
            const response = await axios.get(car.brandUrl);
            const $ = cheerio.load(response.data);

            let carDetailUrlData = []

            $('.bcol-white').each((index, element) => {
                const carDetailUrl = $(element).find('a').attr('href');
                if (carDetailUrl) {
                    carDetailUrlData.push({
                        carDetailUrl
                    });
                }
                console.log(carDetailUrl);
            });

            for (let carDetail of carDetailUrlData) {
                const response = await axios.get(carDetail.carDetailUrl);
                const $ = cheerio.load(response.data);

                let carDetailData = []

                $('.bcol-white p').each((index, element) => {
                    const carDetail = $(element).find('a').attr('href');
                    if (carDetail) {
                        carDetailData.push({
                            carDetail
                        });

                        console.log("car detail final", carDetail);
                    }
                });

                for (let carDetail of carDetailData) {
                    const response = await axios.get(carDetail.carDetail);
                    const $ = cheerio.load(response.data);



                    let carDetailData = {
                        engine_specs: '',
                        cylinders: '',
                        displacement: '',
                        engine_power: '',
                        torque: '',
                        fuel_system: '',
                        fuel: '',
                        fuel_capacity: '',
                        drive_type: '',
                        gearbox: '',
                        brake_front: '',
                        brake_back: '',
                        tire_size: '',
                        dimension_length: '',
                        width: '',
                        height: '',
                        front_rear_track: '',
                        wheelbase: '',
                        ground_clearance: '',
                        cargo_volume: '',
                        aerodynamics: '',
                        unladen_weight: '',
                        fuel_economy_city: '',
                        fuel_economy_highway: '',
                        fuel_economy_combined: '',
                        description_title: '',
                        description: ''
                    };

                    const productionYearsText = $('.newstext.modelbox .nomgtop').html();
                    let productionYears = null;
                    // Usa expressão regular para extrair os anos de produção
                    const productionYearsMatch = productionYearsText.match(/<b>Production years:<\/b>\s*(\d{4}(?:, \d{4})*)/);


                    // Verifica se encontrou os anos de produção
                    if (productionYearsMatch) {
                        productionYears = productionYearsMatch[1]; // Pega os anos encontrados
                        console.log('Production years:', productionYears);
                    } else {
                        console.log('Production years não encontrados');
                    }
                    carDetailData.engine_specs = $('.techdata').find('th:contains("ENGINE SPECS - ") span').text().trim()
                    carDetailData.cylinders = $('.techdata').find('td:contains("Cylinders:")').next().text().trim();
                    carDetailData.displacement = $('.techdata').find('td:contains("Displacement:")').next().text().trim();
                    carDetailData.engine_power = $('.techdata').find('td:contains("Power:")').next().text().trim();
                    carDetailData.torque = $('.techdata').find('td:contains("Torque:")').next().text().trim();
                    carDetailData.fuel_system = $('.techdata').find('td:contains("Fuel System:")').next().text().trim();
                    carDetailData.fuel = $('.techdata').find('td:contains("Fuel:")').next().text().trim();
                    carDetailData.fuel_capacity = $('.techdata').find('td:contains("Fuel capacity:")').next().text().trim();
                    carDetailData.drive_type = $('.techdata').find('td:contains("Drive Type:")').next().text().trim();
                    carDetailData.gearbox = $('.techdata').find('td:contains("Gearbox:")').next().text().trim();
                    carDetailData.brake_front = $('.techdata').find('td:contains("Front:")').next().text().trim();
                    carDetailData.brake_back = $('.techdata').find('td:contains("Rear:")').next().text().trim();
                    carDetailData.tire_size = $('.techdata').find('td:contains("Tire Size:")').next().text().trim();
                    carDetailData.dimension_length = $('.techdata').find('td:contains("Length:")').next().text().trim();
                    carDetailData.width = $('.techdata').find('td:contains("Width:")').next().text().trim();
                    carDetailData.height = $('.techdata').find('td:contains("Height:")').next().text().trim();
                    carDetailData.front_rear_track = $('.techdata').find('td:contains("Front/rear Track:")').next().text().trim();
                    carDetailData.wheelbase = $('.techdata').find('td:contains("Wheelbase:")').next().text().trim();
                    carDetailData.ground_clearance = $('.techdata').find('td:contains("Ground clearance:")').next().text().trim() || null;
                    carDetailData.cargo_volume = $('.techdata').find('td:contains("Cargo Volume:")').next().text().trim();
                    carDetailData.aerodynamics = $('.techdata').find('td:contains("Aerodynamics:")').next().text().trim();
                    carDetailData.unladen_weight = $('.techdata').find('td:contains("Unladen Weight:")').next().text().trim() || null;
                    carDetailData.fuel_economy_city = $('.techdata').find('td:contains(City:")').next().text().trim() || null;
                    carDetailData.fuel_economy_highway = $('.techdata').find('td:contains("Highway:")').next().text().trim() || null;
                    carDetailData.fuel_economy_combined = $('.techdata').find('td:contains("Combined:")').next().text().trim() || null;
                    carDetailData.description_title = ""
                    carDetailData.description = ""

                    carDetailData.name = $('.sbox10.mgbot_20.mgtop_10').find('.motlisthead').contents().filter(function () {
                        return this.nodeType === 3; // Nó de texto
                    }).text().trim();

                    carDetailData.production_years = productionYears;
                    const brandName = $('.motlisthead_prod').text().trim();
                    console.log('Nome da marca:', brandName);
                    carDetailData.brand_id = await getBrandId(brandName);

                    console.log('Dados do carro:', carDetailData);

                    await saveCarData(carDetailData);

                }
            }
        }

    } catch (error) {
        console.error('Erro ao fazer scraping:', error);


    } finally {
        await client.end();
        console.log('Conexão com o banco de dados fechada');
    }
}

main();
