-- Обновление таблицы пользователей для реферальной системы

-- Добавление поля referral_code, если его еще нет
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- Добавление поля referred_by, если его еще нет
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20);

-- Добавление поля balance_kgs, если его еще нет
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS balance_kgs DECIMAL(10, 2) DEFAULT 0;

-- Добавление поля total_earned, если его еще нет
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS total_earned DECIMAL(10, 2) DEFAULT 0;

-- Добавление полей для отслеживания количества рефералов по уровням
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS level_1_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level_2_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level_3_referrals INTEGER DEFAULT 0;

-- Создание индекса для ускорения поиска по referral_code
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- Создание индекса для ускорения поиска по referred_by
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- Создание таблицы для отслеживания реферальных транзакций
CREATE TABLE IF NOT EXISTS referral_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    referrer_id UUID REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    level INTEGER NOT NULL, -- 1, 2 или 3 уровень
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT,
    status VARCHAR(20) DEFAULT 'completed'
);

-- Создание функции для генерации уникального реферального кода
CREATE OR REPLACE FUNCTION generate_referral_code() 
RETURNS TRIGGER AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
    pos INTEGER := 0;
BEGIN
    -- Генерация случайного кода из 8 символов
    FOR i IN 1..8 LOOP
        pos := 1 + FLOOR(RANDOM() * LENGTH(chars));
        result := result || SUBSTRING(chars FROM pos FOR 1);
    END LOOP;
    
    -- Добавление части email для уникальности
    result := result || SUBSTRING(NEW.email FROM 1 FOR 3);
    
    NEW.referral_code := UPPER(result);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создание триггера для автоматической генерации реферального кода при создании пользователя
DROP TRIGGER IF EXISTS generate_referral_code_trigger ON users;
CREATE TRIGGER generate_referral_code_trigger
BEFORE INSERT ON users
FOR EACH ROW
WHEN (NEW.referral_code IS NULL)
EXECUTE FUNCTION generate_referral_code();

-- Обновление существующих пользователей, у которых нет реферального кода
UPDATE users
SET referral_code = UPPER(
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 5) || 
    SUBSTRING(email FROM 1 FOR 3)
)
WHERE referral_code IS NULL;

-- Создание функции для обновления количества рефералов
CREATE OR REPLACE FUNCTION update_referral_counts() 
RETURNS TRIGGER AS $$
DECLARE
    level1_id UUID;
    level2_id UUID;
    level3_id UUID;
    level1_code VARCHAR(20);
    level2_code VARCHAR(20);
    level3_code VARCHAR(20);
BEGIN
    -- Получаем реферальный код пригласившего (уровень 1)
    SELECT id, referral_code INTO level1_id, level1_code
    FROM users
    WHERE referral_code = NEW.referred_by;
    
    IF level1_id IS NOT NULL THEN
        -- Увеличиваем счетчик рефералов 1 уровня
        UPDATE users
        SET level_1_referrals = level_1_referrals + 1
        WHERE id = level1_id;
        
        -- Получаем реферальный код пригласившего уровня 2
        SELECT id, referred_by INTO level2_id, level2_code
        FROM users
        WHERE id = level1_id;
        
        IF level2_id IS NOT NULL AND level2_code IS NOT NULL THEN
            -- Получаем ID пользователя уровня 2
            SELECT id INTO level2_id
            FROM users
            WHERE referral_code = level2_code;
            
            IF level2_id IS NOT NULL THEN
                -- Увеличиваем счетчик рефералов 2 уровня
                UPDATE users
                SET level_2_referrals = level_2_referrals + 1
                WHERE id = level2_id;
                
                -- Получаем реферальный код пригласившего уровня 3
                SELECT referred_by INTO level3_code
                FROM users
                WHERE id = level2_id;
                
                IF level3_code IS NOT NULL THEN
                    -- Получаем ID пользователя уровня 3
                    SELECT id INTO level3_id
                    FROM users
                    WHERE referral_code = level3_code;
                    
                    IF level3_id IS NOT NULL THEN
                        -- Увеличиваем счетчик рефералов 3 уровня
                        UPDATE users
                        SET level_3_referrals = level_3_referrals + 1
                        WHERE id = level3_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создание триггера для обновления количества рефералов при регистрации нового пользователя
DROP TRIGGER IF EXISTS update_referral_counts_trigger ON users;
CREATE TRIGGER update_referral_counts_trigger
AFTER INSERT ON users
FOR EACH ROW
WHEN (NEW.referred_by IS NOT NULL)
EXECUTE FUNCTION update_referral_counts();