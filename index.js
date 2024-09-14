const express = require("express");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require('pg');

const TOKEN = "7286561638:AAH7BVdWXJJog_Ur59x9KRCEYk7wpEmQ1bc"; 
const server = express();
const bot = new TelegramBot(TOKEN, {
    polling: true
});
const port = process.env.PORT || 5000;
const gameName = "UnityTGTest";
const queries = {};

// Настройка подключения к базе данных
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'UnityTGTest',
    password: 'G5f4d3s2a1', // Замените на ваш реальный пароль
    port: 5432,
});

server.use(express.static(path.join(__dirname, 'TelegrammTestGame')));
server.use(express.json());

const SECRET_KEY = "YOUR_SECRET_KEY"; // Замените на свой закрытый ключ

// Функция для проверки закрытого ключа в заголовке
function checkSecretKey(req, res, next) {
    const clientKey = req.headers['x-secret-key']; // Получаем ключ из заголовка

    if (clientKey !== SECRET_KEY) {
        return res.status(403).json({ error: "Invalid secret key." });
    }

    next(); // Продолжаем выполнение, если ключ корректный
}

bot.onText(/help/, (msg) => bot.sendMessage(msg.from.id, "Say /game if you want to play."));
bot.onText(/start|game/, (msg) => bot.sendGame(msg.from.id, gameName));

// Обработка callback_query для кнопки Play
bot.on("callback_query", async function (query) {
    if (query.game_short_name !== gameName) {
        bot.answerCallbackQuery(query.id, "Sorry, '" + query.game_short_name + "' is not available.");
    } else {
        queries[query.id] = query;
        let gameurl = "https://ilnurkfu.github.io/TelegrammTestGame/";

        try {
            const userId = query.from.id;
            const username = query.from.username || "Anonymous";

            console.log(`Получен запрос от пользователя: ID = ${userId}, username = ${username}`);

            const client = await pool.connect();

            // Проверяем, существует ли пользователь
            const userCheckResult = await client.query('SELECT * FROM public."Users" WHERE user_id = $1', [userId]);

            if (userCheckResult.rowCount === 0) {
                // Если пользователь не существует, создаем новую запись
                await client.query('INSERT INTO public."Users" (user_id, username, score) VALUES ($1, $2, $3)', [userId, username, 0]);
                console.log(`Добавлен новый пользователь: ${username} (ID: ${userId})`);
            } else {
                // Если пользователь существует, обновляем username, если он изменился
                const existingUser = userCheckResult.rows[0];
                if (existingUser.username !== username) {
                    await client.query('UPDATE public."Users" SET username = $1 WHERE user_id = $2', [username, userId]);
                    console.log(`Обновлен username для пользователя с ID: ${userId}`);
                } else {
                    console.log(`Пользователь с ID ${userId} уже существует и username не изменился`);
                }
            }

            client.release();
        } catch (error) {
            console.error('Ошибка при добавлении пользователя:', error);
        }

        bot.answerCallbackQuery({
            callback_query_id: query.id,
            url: gameurl
        });
    }
});

server.get('/', (req, res) => {
    res.send('Server is running');
});

// Эндпоинт для обновления счета с проверкой ключа
server.post("/submit-score", checkSecretKey, async (req, res) => {
    const { user_id, score } = req.body;
    console.log(`submit-score`);

    try {
        await pool.query(`
            INSERT INTO public."Users" (user_id, score)
            VALUES ($1, $2)
            ON CONFLICT (user_id)
            DO UPDATE SET score = GREATEST(Users.score, EXCLUDED.score);
        `, [user_id, score]);
        res.send('Результат сохранен.');
    } catch (error) {
        console.error('Ошибка при сохранении результата:', error);
        res.status(500).send('Ошибка сервера.');
    }
});

async function getLeaderboard() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT user_id, username, score FROM public."Users" ORDER BY score DESC LIMIT 10');
        return res.rows;
    } finally {
        client.release();
    }
}

// Эндпоинт для получения информации о пользователе с проверкой ключа
server.get("/user-info", checkSecretKey, async (req, res) => {
    const callbackQueryId = req.query.callback_query_id; // Получаем ID callback-запроса

    if (!callbackQueryId || !queries[callbackQueryId]) {
        return res.status(400).json({ error: "Invalid callback query ID." });
    }

    const query = queries[callbackQueryId];
    const userId = query.from.id;
    const username = query.from.username || "Anonymous";

    console.log(`Запрос на получение данных пользователя: ID = ${userId}, username = ${username}`);

    res.json({ user_id: userId, username: username }); // Возвращаем данные пользователя
});

server.get('/leaderboard', checkSecretKey, async (req, res) => {
    try {
        const leaderboard = await getLeaderboard();
        res.json(leaderboard);
    } catch (error) {
        console.error('Error retrieving leaderboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://192.168.0.2:${port}`);
});
