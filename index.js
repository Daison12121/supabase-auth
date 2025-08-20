import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Поддержка JSON и form-data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

app.post("/get-user", async (req, res) => {
  try {
    // email может прийти как в JSON, так и в form-data
    const email = req.body.email;

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
