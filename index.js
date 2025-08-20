import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();

// Настройка CORS для работы с Tilda
app.use(cors({
  origin: '*', // В продакшене лучше указать конкретный домен Tilda
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Поддержка JSON и form-data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Маршрут для проверки работоспособности сервера
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Supabase Auth Server работает" });
});

app.post("/get-user", async (req, res) => {
  try {
    // Логирование для отладки
    console.log("Получен запрос:", req.method, req.url);
    console.log("Заголовки:", JSON.stringify(req.headers));
    console.log("Тело запроса:", JSON.stringify(req.body));
    
    // Проверка, является ли это тестовым запросом от Tilda при настройке вебхука
    // Tilda обычно отправляет пустой запрос или запрос без данных при проверке вебхука
    if (Object.keys(req.body).length === 0 || 
        (req.headers['user-agent'] && req.headers['user-agent'].includes('Tilda'))) {
      console.log("Обнаружен тестовый запрос от Tilda");
      return res.status(200).json({ status: "ok", message: "Webhook проверен успешно" });
    }
    
    // email может прийти как в JSON, так и в form-data, или в originalData
    let email = req.body.email;
    
    // Проверяем, есть ли данные из перехватчика консоли
    if (req.body.source === 'console-interceptor' && req.body.originalData) {
      console.log("Получены данные из перехватчика консоли:", req.body.originalData);
      
      // Если email уже извлечен перехватчиком, используем его
      if (email) {
        console.log("Используем email из перехватчика:", email);
      } 
      // Иначе пытаемся извлечь email из originalData
      else {
        const originalData = req.body.originalData;
        
        if (originalData.fields && originalData.fields.Email) {
          email = originalData.fields.Email;
        } else if (originalData.fields && originalData.fields.email) {
          email = originalData.fields.email;
        } else if (originalData.Email) {
          email = originalData.Email;
        } else if (originalData.email) {
          email = originalData.email;
        }
        
        console.log("Извлечен email из originalData:", email);
      }
    }

    if (!email) {
      return res.status(400).json({ error: "Не передан email" });
    }

    // Запрос к Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${email}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (data.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    return res.json(data[0]); // Возвращаем первого найденного
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
