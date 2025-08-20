import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import referralRoutes from "./referral-routes.js";

dotenv.config();
const app = express();

// Настройка CORS для работы с Tilda
app.use(cors({
  origin: '*', // В продакшене лучше указать конкретный домен Tilda
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Interceptor-Request']
}));

// Поддержка JSON и form-data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обслуживание статических файлов
app.use(express.static('.'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Подключаем маршруты для реферальной системы
app.use("/referral", referralRoutes);

// Маршрут для обслуживания скрипта реферальной системы
app.get("/tilda-referral-system.js", (req, res) => {
  res.sendFile(__dirname + "/tilda-referral-system.js");
});

// Маршрут для проверки работоспособности сервера
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Supabase Auth Server работает" });
});

app.post("/get-user", async (req, res) => {
  try {
    // Логирование для отладки
    console.log("Получен запрос:", req.method, req.url);
    console.log("Заголовки:", JSON.stringify(req.headers));
    
    // Проверяем, не слишком ли большое тело запроса (для предотвращения рекурсии)
    const requestBodySize = JSON.stringify(req.body).length;
    if (requestBodySize > 10000) {
      console.log("Слишком большое тело запроса:", requestBodySize, "байт. Возможна рекурсия.");
      return res.status(413).json({ error: "Слишком большое тело запроса" });
    }
    
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
    
    // Проверяем, есть ли данные из перехватчика
    if (req.body.source && req.body.originalData) {
      console.log("Получены данные из перехватчика:", req.body.source);
      
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

// Обработчик для регистрации пользователя с реферальной системой
app.post("/register-with-referral", async (req, res) => {
  try {
    // Логирование для отладки
    console.log("Получен запрос на регистрацию:", req.method, req.url);
    console.log("Заголовки:", JSON.stringify(req.headers));
    
    // Проверяем, не слишком ли большое тело запроса
    const requestBodySize = JSON.stringify(req.body).length;
    if (requestBodySize > 10000) {
      console.log("Слишком большое тело запроса:", requestBodySize, "байт. Возможна рекурсия.");
      return res.status(413).json({ error: "Слишком большое тело запроса" });
    }
    
    console.log("Тело запроса:", JSON.stringify(req.body));
    
    // Проверка, является ли это тестовым запросом от Tilda при настройке вебхука
    if (Object.keys(req.body).length === 0 || 
        (req.headers['user-agent'] && req.headers['user-agent'].includes('Tilda'))) {
      console.log("Обнаружен тестовый запрос от Tilda");
      return res.status(200).json({ status: "ok", message: "Webhook проверен успешно" });
    }
    
    // Извлекаем email и имя из запроса
    let email = req.body.email;
    let name = req.body.name;
    let referralCode = req.body.referralCode;
    
    // Логируем все поля запроса для отладки
    console.log("Все поля запроса:", Object.keys(req.body).map(key => `${key}: ${req.body[key]}`).join(', '));
    
    // Проверяем все возможные варианты имен полей для реферального кода
    if (!referralCode) {
      const possibleReferralCodeFields = [
        'referralCode', 'ReferralCode', 'referral_code', 'Referral_code', 
        'referralcode', 'Referralcode', 'ref', 'Ref', 'refcode', 'Refcode'
      ];
      
      for (const field of possibleReferralCodeFields) {
        if (req.body[field]) {
          referralCode = req.body[field];
          console.log(`Найден реферальный код в поле ${field}:`, referralCode);
          break;
        }
      }
    }
    
    // Проверяем, есть ли данные из перехватчика
    if (req.body.source && req.body.originalData) {
      console.log("Получены данные из перехватчика:", req.body.source);
      
      const originalData = req.body.originalData;
      
      // Извлекаем email
      if (!email) {
        if (originalData.fields && originalData.fields.Email) {
          email = originalData.fields.Email;
        } else if (originalData.fields && originalData.fields.email) {
          email = originalData.fields.email;
        } else if (originalData.Email) {
          email = originalData.Email;
        } else if (originalData.email) {
          email = originalData.email;
        }
      }
      
      // Извлекаем имя
      if (!name) {
        if (originalData.fields && originalData.fields.Name) {
          name = originalData.fields.Name;
        } else if (originalData.fields && originalData.fields.name) {
          name = originalData.fields.name;
        } else if (originalData.Name) {
          name = originalData.Name;
        } else if (originalData.name) {
          name = originalData.name;
        }
      }
      
      // Извлекаем реферальный код
      if (!referralCode) {
        if (originalData.fields && originalData.fields.ReferralCode) {
          referralCode = originalData.fields.ReferralCode;
        } else if (originalData.fields && originalData.fields.referralCode) {
          referralCode = originalData.fields.referralCode;
        } else if (originalData.ReferralCode) {
          referralCode = originalData.ReferralCode;
        } else if (originalData.referralCode) {
          referralCode = originalData.referralCode;
        }
        
        // Проверяем все возможные варианты имен полей для реферального кода в originalData
        if (!referralCode && originalData.fields) {
          const possibleReferralCodeFields = [
            'referral_code', 'Referral_code', 'referralcode', 'Referralcode', 
            'ref', 'Ref', 'refcode', 'Refcode'
          ];
          
          for (const field of possibleReferralCodeFields) {
            if (originalData.fields[field]) {
              referralCode = originalData.fields[field];
              console.log(`Найден реферальный код в originalData.fields.${field}:`, referralCode);
              break;
            }
          }
        }
      }
      
      console.log("Извлечены данные из originalData:", { email, name, referralCode });
    }
    
    // Проверяем, есть ли реферальный код в localStorage через куки
    if (!referralCode && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').map(cookie => cookie.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('referralCode=')) {
          referralCode = cookie.substring('referralCode='.length);
          console.log("Найден реферальный код в куках:", referralCode);
          break;
        }
      }
    }

    if (!email) {
      return res.status(400).json({ error: "Не передан email" });
    }
    
    // Генерация реферального кода
    function generateReferralCode(email) {
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const emailPart = email.substring(0, 3).toUpperCase();
      return `${randomPart}${emailPart}`;
    }

    // Проверяем, существует ли уже пользователь с таким email
    const checkUserResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const existingUsers = await checkUserResponse.json();

    if (existingUsers.length > 0) {
      // Если пользователь уже существует, проверяем, есть ли у него реферальный код
      const existingUser = existingUsers[0];
      
      if (!existingUser.referral_code) {
        // Если у пользователя нет реферального кода, генерируем его
        const newReferralCode = generateReferralCode(email);
        
        // Обновляем пользователя с новым реферальным кодом и реферером
        await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${existingUser.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify({
              referral_code: newReferralCode,
              referred_by: referralCode || null,
            }),
          }
        );
        
        // Обновляем объект пользователя
        existingUser.referral_code = newReferralCode;
        existingUser.referred_by = referralCode || null;
      }
      
      return res.json({
        message: "Пользователь уже существует",
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          referral_code: existingUser.referral_code,
          balance_kgs: existingUser.balance_kgs || 0,
        },
      });
    }

    // Если передан реферальный код, проверяем его существование
    let referrerId = null;
    if (referralCode) {
      const referrerResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(referralCode)}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      const referrers = await referrerResponse.json();

      if (referrers.length === 0) {
        console.log("Неверный реферальный код:", referralCode);
        // Продолжаем без реферального кода
        referralCode = null;
      } else {
        referrerId = referrers[0].id;
      }
    }

    // Генерируем реферальный код для нового пользователя
    const newReferralCode = generateReferralCode(email);

    // Создаем нового пользователя
    const createUserResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
    
    // Если пользователь был зарегистрирован с реферальным кодом, обновляем счетчики рефералов
    if (referralCode) {
      console.log("Обновляем счетчики рефералов для реферера с кодом:", referralCode);
      
      try {
        // Получаем информацию о реферере первого уровня
        const level1ReferrerResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(referralCode)}`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        
        const level1Referrers = await level1ReferrerResponse.json();
        
        if (level1Referrers.length > 0) {
          const level1Referrer = level1Referrers[0];
          console.log("Найден реферер первого уровня:", level1Referrer.email);
          
          // Увеличиваем счетчик рефералов первого уровня
          await fetch(
            `${SUPABASE_URL}/rest/v1/users?id=eq.${level1Referrer.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
              },
              body: JSON.stringify({
                level_1_referrals: (level1Referrer.level_1_referrals || 0) + 1,
              }),
            }
          );
          
          console.log("Обновлен счетчик рефералов первого уровня для:", level1Referrer.email);
          
          // Если у реферера первого уровня есть свой реферер, обновляем счетчик рефералов второго уровня
          if (level1Referrer.referred_by) {
            const level2ReferrerResponse = await fetch(
              `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(level1Referrer.referred_by)}`,
              {
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                },
              }
            );
            
            const level2Referrers = await level2ReferrerResponse.json();
            
            if (level2Referrers.length > 0) {
              const level2Referrer = level2Referrers[0];
              console.log("Найден реферер второго уровня:", level2Referrer.email);
              
              // Увеличиваем счетчик рефералов второго уровня
              await fetch(
                `${SUPABASE_URL}/rest/v1/users?id=eq.${level2Referrer.id}`,
                {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                  },
                  body: JSON.stringify({
                    level_2_referrals: (level2Referrer.level_2_referrals || 0) + 1,
                  }),
                }
              );
              
              console.log("Обновлен счетчик рефералов второго уровня для:", level2Referrer.email);
              
              // Если у реферера второго уровня есть свой реферер, обновляем счетчик рефералов третьего уровня
              if (level2Referrer.referred_by) {
                const level3ReferrerResponse = await fetch(
                  `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(level2Referrer.referred_by)}`,
                  {
                    headers: {
                      apikey: SUPABASE_KEY,
                      Authorization: `Bearer ${SUPABASE_KEY}`,
                    },
                  }
                );
                
                const level3Referrers = await level3ReferrerResponse.json();
                
                if (level3Referrers.length > 0) {
                  const level3Referrer = level3Referrers[0];
                  console.log("Найден реферер третьего уровня:", level3Referrer.email);
                  
                  // Увеличиваем счетчик рефералов третьего уровня
                  await fetch(
                    `${SUPABASE_URL}/rest/v1/users?id=eq.${level3Referrer.id}`,
                    {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`,
                      },
                      body: JSON.stringify({
                        level_3_referrals: (level3Referrer.level_3_referrals || 0) + 1,
                      }),
                    }
                  );
                  
                  console.log("Обновлен счетчик рефералов третьего уровня для:", level3Referrer.email);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Ошибка при обновлении счетчиков рефералов:", error);
        // Не прерываем выполнение, так как пользователь уже создан
      }
    }

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

// Обработчик для получения информации о реферальной программе пользователя
app.post("/referral-info", async (req, res) => {
  try {
    // Логирование для отладки
    console.log("Получен запрос на информацию о реферальной программе:", req.method, req.url);
    console.log("Заголовки:", JSON.stringify(req.headers));
    console.log("Тело запроса:", JSON.stringify(req.body));
    
    // Проверка, является ли это тестовым запросом от Tilda при настройке вебхука
    if (Object.keys(req.body).length === 0 || 
        (req.headers['user-agent'] && req.headers['user-agent'].includes('Tilda'))) {
      console.log("Обнаружен тестовый запрос от Tilda");
      return res.status(200).json({ status: "ok", message: "Webhook проверен успешно" });
    }
    
    // Извлекаем email из запроса
    let email = req.body.email;
    
    // Проверяем, есть ли данные из перехватчика
    if (req.body.source && req.body.originalData) {
      console.log("Получены данные из перехватчика:", req.body.source);
      
      const originalData = req.body.originalData;
      
      // Извлекаем email
      if (!email) {
        if (originalData.fields && originalData.fields.Email) {
          email = originalData.fields.Email;
        } else if (originalData.fields && originalData.fields.email) {
          email = originalData.fields.email;
        } else if (originalData.Email) {
          email = originalData.Email;
        } else if (originalData.email) {
          email = originalData.email;
        }
      }
    }

    if (!email) {
      return res.status(400).json({ error: "Не передан email" });
    }

    // Получаем информацию о пользователе
    const userResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const users = await userResponse.json();

    if (users.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const user = users[0];
    
    // Если у пользователя нет реферального кода, генерируем его
    if (!user.referral_code) {
      // Функция для генерации реферального кода
      function generateReferralCode(email) {
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const emailPart = email.substring(0, 3).toUpperCase();
        return `${randomPart}${emailPart}`;
      }
      
      const referralCode = generateReferralCode(email);
      
      // Обновляем пользователя с новым реферальным кодом
      await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            referral_code: referralCode,
          }),
        }
      );
      
      // Обновляем объект пользователя
      user.referral_code = referralCode;
    }

    // Получаем список рефералов первого уровня
    const level1ReferralsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?referred_by=eq.${encodeURIComponent(user.referral_code)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const level1Referrals = await level1ReferralsResponse.json();

    // Получаем транзакции пользователя
    const transactionsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/referral_transactions?user_id=eq.${user.id}&order=transaction_date.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
        balance_kgs: user.balance_kgs || 0,
        total_earned: user.total_earned || 0,
      },
      referral_stats: {
        level_1_count: user.level_1_referrals || 0,
        level_2_count: user.level_2_referrals || 0,
        level_3_count: user.level_3_referrals || 0,
        total_referrals: (user.level_1_referrals || 0) + (user.level_2_referrals || 0) + (user.level_3_referrals || 0),
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
        level_1: "30%",
        level_2: "10%",
        level_3: "5%",
      },
    });
  } catch (error) {
    console.error("Ошибка при получении информации о реферальной программе:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Обработчик для начисления реферальных вознаграждений
app.post("/process-referral-payment", async (req, res) => {
  try {
    // Логирование для отладки
    console.log("Получен запрос на начисление вознаграждения:", req.method, req.url);
    console.log("Заголовки:", JSON.stringify(req.headers));
    console.log("Тело запроса:", JSON.stringify(req.body));
    
    // Проверка, является ли это тестовым запросом от Tilda при настройке вебхука
    if (Object.keys(req.body).length === 0 || 
        (req.headers['user-agent'] && req.headers['user-agent'].includes('Tilda'))) {
      console.log("Обнаружен тестовый запрос от Tilda");
      return res.status(200).json({ status: "ok", message: "Webhook проверен успешно" });
    }
    
    // Извлекаем данные из запроса
    let email = req.body.email;
    let amount = parseFloat(req.body.amount);
    let description = req.body.description;
    
    // Проверяем, есть ли данные из перехватчика
    if (req.body.source && req.body.originalData) {
      console.log("Получены данные из перехватчика:", req.body.source);
      
      const originalData = req.body.originalData;
      
      // Извлекаем email
      if (!email) {
        if (originalData.fields && originalData.fields.Email) {
          email = originalData.fields.Email;
        } else if (originalData.fields && originalData.fields.email) {
          email = originalData.fields.email;
        } else if (originalData.Email) {
          email = originalData.Email;
        } else if (originalData.email) {
          email = originalData.email;
        }
      }
      
      // Извлекаем сумму
      if (!amount) {
        if (originalData.fields && originalData.fields.Amount) {
          amount = parseFloat(originalData.fields.Amount);
        } else if (originalData.fields && originalData.fields.amount) {
          amount = parseFloat(originalData.fields.amount);
        } else if (originalData.Amount) {
          amount = parseFloat(originalData.Amount);
        } else if (originalData.amount) {
          amount = parseFloat(originalData.amount);
        }
      }
      
      // Извлекаем описание
      if (!description) {
        if (originalData.fields && originalData.fields.Description) {
          description = originalData.fields.Description;
        } else if (originalData.fields && originalData.fields.description) {
          description = originalData.fields.description;
        } else if (originalData.Description) {
          description = originalData.Description;
        } else if (originalData.description) {
          description = originalData.description;
        }
      }
    }

    if (!email || !amount) {
      return res.status(400).json({ error: "Не переданы email или сумма" });
    }
    
    // Константы для реферальной системы
    const REFERRAL_LEVELS = {
      LEVEL_1: 0.3, // 30% для первого уровня
      LEVEL_2: 0.1, // 10% для второго уровня
      LEVEL_3: 0.05 // 5% для третьего уровня
    };

    // Получаем информацию о пользователе
    const userResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
      `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(user.referred_by)}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
      `${SUPABASE_URL}/rest/v1/users?id=eq.${level1Referrer.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          balance_kgs: (level1Referrer.balance_kgs || 0) + level1Reward,
          total_earned: (level1Referrer.total_earned || 0) + level1Reward,
        }),
      }
    );

    // Записываем транзакцию для реферера первого уровня
    await fetch(
      `${SUPABASE_URL}/rest/v1/referral_transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
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
        `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(level1Referrer.referred_by)}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      const level2Referrers = await level2ReferrerResponse.json();

      if (level2Referrers.length > 0) {
        const level2Referrer = level2Referrers[0];
        const level2Reward = amount * REFERRAL_LEVELS.LEVEL_2;

        // Начисляем вознаграждение рефереру второго уровня
        await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${level2Referrer.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify({
              balance_kgs: (level2Referrer.balance_kgs || 0) + level2Reward,
              total_earned: (level2Referrer.total_earned || 0) + level2Reward,
            }),
          }
        );

        // Записываем транзакцию для реферера второго уровня
        await fetch(
          `${SUPABASE_URL}/rest/v1/referral_transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
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
            `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(level2Referrer.referred_by)}`,
            {
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
              },
            }
          );

          const level3Referrers = await level3ReferrerResponse.json();

          if (level3Referrers.length > 0) {
            const level3Referrer = level3Referrers[0];
            const level3Reward = amount * REFERRAL_LEVELS.LEVEL_3;

            // Начисляем вознаграждение рефереру третьего уровня
            await fetch(
              `${SUPABASE_URL}/rest/v1/users?id=eq.${level3Referrer.id}`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                },
                body: JSON.stringify({
                  balance_kgs: (level3Referrer.balance_kgs || 0) + level3Reward,
                  total_earned: (level3Referrer.total_earned || 0) + level3Reward,
                }),
              }
            );

            // Записываем транзакцию для реферера третьего уровня
            await fetch(
              `${SUPABASE_URL}/rest/v1/referral_transactions`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
