const express = require("express");
const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");

const app = express();

const allowedOrigins = [
  "http://localhost",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
];

// Middleware
app.use(helmet());
app.use(express.json()); // для парсинга JSON
app.use(express.urlencoded({ extended: true })); // для парсинга form-data
app.use(
  cors({
    origin: function (origin, callback) {
      // Разрешаем запросы без origin (например, из Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Домен не разрешен для CORS"));
      }
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
  })
);

// Настройка Multer
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Только JPG, PNG или PDF!"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Создаем папку uploads, если её нет
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Роут для заявки
app.post("/api/submit-ticket", upload.single("proof"), async (req, res) => {
  try {
    const { name, email, ticketsCount } = req.body;
    const proofFile = req.file;

    if (!name || !email || !ticketsCount || !proofFile) {
      return res.status(400).json({ error: "Все поля обязательны!" });
    }

    await sendToTelegram({
      name,
      email,
      ticketsCount,
      filePath: proofFile.path,
    });
    fs.unlinkSync(proofFile.path);

    res.header("Access-Control-Allow-Origin", "http://127.0.0.1:5500"); // Ваш фронтенд
    res.header("Access-Control-Allow-Methods", "POST");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res
      .status(200)
      .set("Content-Type", "application/json")
      .json({ success: true });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// Функция отправки в Telegram
async function sendToTelegram({ name, email, ticketsCount, filePath }) {
  API_TOKEN = "8098380496:AAGmX1tDeS9CA0L7_Kr9yQXnsh09YROfTa0";
  api_id = "26596224";
  api_hash = "fd6dc7236be56e3b89fb1b7199f84f9f";
  const botToken = "8098380496:AAGmX1tDeS9CA0L7_Kr9yQXnsh09YROfTa0";
  const chatId = "@AllFootballYouNeed";

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", fs.createReadStream(filePath));
  form.append(
    "caption",
    `🎟 Новая заявка!\nИмя: ${name}\nEmail: ${email}\nБилетов: ${ticketsCount}`
  );

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      form,
      {
        headers: form.getHeaders(),
      }
    );
    console.log("Telegram ответ:", response.data);
  } catch (error) {
    console.error(
      "Ошибка Telegram API:",
      error.response?.data || error.message
    );
    throw new Error("Не удалось отправить в Telegram");
  }
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
