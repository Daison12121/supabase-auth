import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Константы для реферальной системы
const REFERRAL_LEVELS = {
  LEVEL_1: 0.3, // 30% для первого уровня
  LEVEL_2: 0.1, // 10% для второго уровня
  LEVEL_3: 0.05 // 5% для третьего уровня
};

// Функция для генерации реферального кода
function generateReferralCode(email) {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const emailPart = email.substring(0, 3).toUpperCase();
  return `${randomPart}${emailPart}`;
}

// Эндпоинт для регистрации пользователя с реферальным кодом
router.post("/register-with-referral", async (req, res) => {
  try {
    const { email, name, referralCode } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email обязателен" });
    }

    // Проверяем, существует ли уже пользователь с таким email
    const checkUserResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    const existingUsers = await checkUserResponse.json();

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Пользователь с таким email уже существует" });
    }

    // Если передан реферальный код, проверяем его существование
    let referrerId = null;
    if (referralCode) {
      const referrerResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(referralCode)}`,
        {
          headers: {
            apikey: process.env.SUPABASE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          },
        }
      );

      const referrers = await referrerResponse.json();

      if (referrers.length === 0) {
        return res.status(400).json({ error: "Неверный реферальный код" });
      }

      referrerId = referrers[0].id;
    }

    // Генерируем реферальный код для нового пользователя
    const newReferralCode = generateReferralCode(email);

    // Создаем нового пользователя
    const createUserResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          email,
          name: name || email.split("@")[0],
          referral_code: newReferralCode,
          referred_by: referralCode || null,
          balance_kgs: 0,
          total_earned: 0,
          level_1_referrals: 0,
          level_2_referrals: 0,
          level_3_referrals: 0,
          created_at: new Date().toISOString(),
        }),
      }
    );

    if (!createUserResponse.ok) {
      const errorData = await createUserResponse.json();
      console.error("Ошибка при создании пользователя:", errorData);
      return res.status(500).json({ error: "Ошибка при создании пользователя" });
    }

    const newUser = await createUserResponse.json();

    return res.status(201).json({
      message: "Пользователь успешно зарегистрирован",
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        name: newUser[0].name,
        referral_code: newUser[0].referral_code,
        balance_kgs: newUser[0].balance_kgs,
      },
    });
  } catch (error) {
    console.error("Ошибка при регистрации пользователя:", error);
    res.status(500).json({ error: "Ошибка сервера при регистрации" });
  }
});

// Эндпоинт для получения информации о реферальной программе пользователя
router.post("/referral-info", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email обязателен" });
    }

    // Получаем информацию о пользователе
    const userResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    const users = await userResponse.json();

    if (users.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const user = users[0];

    // Получаем список рефералов первого уровня
    const level1ReferralsResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?referred_by=eq.${encodeURIComponent(user.referral_code)}`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    const level1Referrals = await level1ReferralsResponse.json();

    // Получаем транзакции пользователя
    const transactionsResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/referral_transactions?user_id=eq.${user.id}&order=transaction_date.desc`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    const transactions = await transactionsResponse.json();

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        referral_code: user.referral_code,
        balance_kgs: user.balance_kgs,
        total_earned: user.total_earned,
      },
      referral_stats: {
        level_1_count: user.level_1_referrals,
        level_2_count: user.level_2_referrals,
        level_3_count: user.level_3_referrals,
        total_referrals: user.level_1_referrals + user.level_2_referrals + user.level_3_referrals,
      },
      level_1_referrals: level1Referrals.map(ref => ({
        name: ref.name,
        email: ref.email,
        created_at: ref.created_at,
      })),
      recent_transactions: transactions.slice(0, 10).map(tx => ({
        amount: tx.amount,
        level: tx.level,
        date: tx.transaction_date,
        description: tx.description,
      })),
      referral_rates: {
        level_1: REFERRAL_LEVELS.LEVEL_1 * 100 + "%",
        level_2: REFERRAL_LEVELS.LEVEL_2 * 100 + "%",
        level_3: REFERRAL_LEVELS.LEVEL_3 * 100 + "%",
      },
    });
  } catch (error) {
    console.error("Ошибка при получении информации о реферальной программе:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Эндпоинт для начисления реферальных вознаграждений
router.post("/process-referral-payment", async (req, res) => {
  try {
    const { email, amount, description } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ error: "Email и сумма обязательны" });
    }

    // Получаем информацию о пользователе
    const userResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    const users = await userResponse.json();

    if (users.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const user = users[0];

    // Проверяем, есть ли у пользователя реферер
    if (!user.referred_by) {
      return res.json({ message: "У пользователя нет реферера, вознаграждение не начислено" });
    }

    // Получаем информацию о рефереры первого уровня
    const level1ReferrerResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(user.referred_by)}`,
      {
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
      }
    );

    const level1Referrers = await level1ReferrerResponse.json();

    if (level1Referrers.length === 0) {
      return res.json({ message: "Реферер первого уровня не найден, вознаграждение не начислено" });
    }

    const level1Referrer = level1Referrers[0];
    const level1Reward = amount * REFERRAL_LEVELS.LEVEL_1;

    // Начисляем вознаграждение рефереру первого уровня
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${level1Referrer.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          balance_kgs: level1Referrer.balance_kgs + level1Reward,
          total_earned: level1Referrer.total_earned + level1Reward,
        }),
      }
    );

    // Записываем транзакцию для реферера первого уровня
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/referral_transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          user_id: level1Referrer.id,
          referrer_id: user.id,
          amount: level1Reward,
          level: 1,
          description: description || `Реферальное вознаграждение 1 уровня от ${user.email}`,
        }),
      }
    );

    // Проверяем, есть ли у реферера первого уровня свой реферер (для второго уровня)
    if (level1Referrer.referred_by) {
      const level2ReferrerResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(level1Referrer.referred_by)}`,
        {
          headers: {
            apikey: process.env.SUPABASE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          },
        }
      );

      const level2Referrers = await level2ReferrerResponse.json();

      if (level2Referrers.length > 0) {
        const level2Referrer = level2Referrers[0];
        const level2Reward = amount * REFERRAL_LEVELS.LEVEL_2;

        // Начисляем вознаграждение рефереру второго уровня
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${level2Referrer.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: process.env.SUPABASE_KEY,
              Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
            },
            body: JSON.stringify({
              balance_kgs: level2Referrer.balance_kgs + level2Reward,
              total_earned: level2Referrer.total_earned + level2Reward,
            }),
          }
        );

        // Записываем транзакцию для реферера второго уровня
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/referral_transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: process.env.SUPABASE_KEY,
              Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
            },
            body: JSON.stringify({
              user_id: level2Referrer.id,
              referrer_id: user.id,
              amount: level2Reward,
              level: 2,
              description: description || `Реферальное вознаграждение 2 уровня от ${user.email}`,
            }),
          }
        );

        // Проверяем, есть ли у реферера второго уровня свой реферер (для третьего уровня)
        if (level2Referrer.referred_by) {
          const level3ReferrerResponse = await fetch(
            `${process.env.SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(level2Referrer.referred_by)}`,
            {
              headers: {
                apikey: process.env.SUPABASE_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
              },
            }
          );

          const level3Referrers = await level3ReferrerResponse.json();

          if (level3Referrers.length > 0) {
            const level3Referrer = level3Referrers[0];
            const level3Reward = amount * REFERRAL_LEVELS.LEVEL_3;

            // Начисляем вознаграждение рефереру третьего уровня
            await fetch(
              `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${level3Referrer.id}`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  apikey: process.env.SUPABASE_KEY,
                  Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
                },
                body: JSON.stringify({
                  balance_kgs: level3Referrer.balance_kgs + level3Reward,
                  total_earned: level3Referrer.total_earned + level3Reward,
                }),
              }
            );

            // Записываем транзакцию для реферера третьего уровня
            await fetch(
              `${process.env.SUPABASE_URL}/rest/v1/referral_transactions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: process.env.SUPABASE_KEY,
                  Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
                },
                body: JSON.stringify({
                  user_id: level3Referrer.id,
                  referrer_id: user.id,
                  amount: level3Reward,
                  level: 3,
                  description: description || `Реферальное вознаграждение 3 уровня от ${user.email}`,
                }),
              }
            );
          }
        }
      }
    }

    return res.json({
      message: "Реферальные вознаграждения успешно начислены",
      amount: amount,
      level1_reward: level1Reward,
      level2_reward: level1Referrer.referred_by ? amount * REFERRAL_LEVELS.LEVEL_2 : 0,
      level3_reward: level1Referrer.referred_by ? amount * REFERRAL_LEVELS.LEVEL_3 : 0,
    });
  } catch (error) {
    console.error("Ошибка при начислении реферальных вознаграждений:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;