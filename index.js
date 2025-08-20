import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// ⚡ ВАЖНО: сюда подставь свой anon key из Supabase Settings → API
const SUPABASE_URL = "https://yrmtswwmvclmkydqytvu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlybXRzd3dtdmNsbWt5ZHF5dHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1Njc2MTgsImV4cCI6MjA3MTE0MzYxOH0.Ish8ELhdZnI-LhxoyrcvFsbp5A_MbZUxqCXsfZw3ucs";

// 📌 API endpoint для Тильды
app.post("/get-user", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ error: "Не передан email" });
  }

  try {
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
      return res.json({ error: "Пользователь не найден" });
    }

    res.json(data[0]); // отдаём первого найденного пользователя
  } catch (e) {
    res.json({ error: "Ошибка запроса к Supabase", details: e.message });
  }
});

// 🚀 запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
