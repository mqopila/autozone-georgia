const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("autozone.db");
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    type TEXT NOT NULL,
    year INTEGER NOT NULL,
    price INTEGER NOT NULL,
    fuel TEXT NOT NULL,
    power TEXT NOT NULL,
    image TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
    UNIQUE(visitor_id, car_id)
  );

  CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    quiz_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const catalogBrands = {
  economy: ["Toyota", "Honda", "Hyundai", "Kia", "Mazda", "Volkswagen", "Skoda", "Renault", "Nissan", "Opel"],
  luxury: ["BMW", "Mercedes-Benz", "Audi", "Porsche", "Lexus", "Volvo", "Genesis", "Jaguar", "Mini", "Tesla"],
  suv: ["Toyota", "BMW", "Mercedes-Benz", "Audi", "Honda", "Mazda", "Nissan", "Volkswagen", "Kia", "Volvo"],
  sport: ["Porsche", "Ferrari", "Lamborghini", "Audi", "BMW", "Chevrolet", "Ford", "Mercedes-Benz", "Nissan", "Maserati"],
  electric: ["Tesla", "BMW", "Mercedes-Benz", "Audi", "Hyundai", "Kia", "Nissan", "Porsche", "Volvo", "Mini"]
};

const catalogModels = {
  economy: ["Corolla", "Civic", "Elantra", "Rio", "3", "Golf", "Octavia", "Clio", "Sentra", "Astra"],
  luxury: ["S-Class", "5 Series", "A6", "911", "ES", "XC90", "G80", "XE", "Countryman", "Model S"],
  suv: ["RAV4", "X5", "GLC", "Q5", "CR-V", "CX-5", "X-Trail", "Touareg", "Sportage", "XC60"],
  sport: ["911 Carrera", "F8 Tributo", "Huracan", "RS5", "M4", "Corvette", "Mustang", "AMG GT", "GT-R", "Ghibli"],
  electric: ["Model 3", "i4", "EQS", "e-tron", "Ioniq 5", "EV6", "Leaf", "Taycan", "EX30", "Cooper SE"]
};

const catalogFuel = {
  economy: ["ბენზინი", "ჰიბრიდი", "დიზელი"],
  luxury: ["ბენზინი", "ჰიბრიდი", "დიზელი"],
  suv: ["ბენზინი", "ჰიბრიდი", "დიზელი"],
  sport: ["ბენზინი", "ჰიბრიდი"],
  electric: ["ელექტრო"]
};

const catalogDescriptions = {
  economy: ["ეკონომიური ავტომობილი ყოვедневისთვის.", "მოხერხებული და ეკონომიური არჩევანი."],
  luxury: ["პრეტენზიული კომფორტი და ელეგანტური დიზაინი.", "პრემიუმ კლასის გამოცდილება."],
  suv: ["უნივერსალური SUV ოჯახისა და მოგზაურობისთვის.", "მაღალი გამავლობა და კომფორტი."],
  sport: ["ადრენალინი და მაღალი სიჩქარე.", "დინამიკური შესრულება და განსაკუთრებული სტილი."],
  electric: ["მომავლის ტექნოლოგია და ხმაურის გარეშე მგზავრობა.", "ელექტრო mobility თანამედროვე სტილით."]
};

const buildCatalogSeed = () => {
  const cars = [];
  const typeOrder = ["economy", "luxury", "suv", "sport", "electric"];

  typeOrder.forEach((type, typeIndex) => {
    const brands = catalogBrands[type];
    const models = catalogModels[type];
    const fuels = catalogFuel[type];
    const descriptions = catalogDescriptions[type];

    for (let i = 0; i < 40; i += 1) {
      const brand = brands[(i + typeIndex) % brands.length];
      const model = models[(i + typeIndex * 2) % models.length];
      const year = 2018 + ((i + typeIndex) % 8);
      const price = 12000 + (i * 1200) + typeIndex * 3500;
      const fuel = fuels[i % fuels.length];
      const power = type === "electric"
        ? `${Math.max(120, 200 + i)} კვ` 
        : `${(1.0 + ((i % 9) * 0.4) + typeIndex * 0.6).toFixed(1)} ლ`;
      const image = `https://images.unsplash.com/photo-${["1552519507", "1503376780353", "1560958089", "1519641471654", "1621007947382", "1618843479313"][i % 6]}?auto=format&fit=crop&w=900&q=80`;

      cars.push({
        name: model,
        brand,
        type,
        year,
        price,
        fuel,
        power,
        image,
        description: descriptions[i % descriptions.length]
      });
    }
  });

  return cars;
};

const insertCar = db.prepare(`
  INSERT INTO cars
  (name, brand, type, year, price, fuel, power, image, description)
  VALUES
  (@name, @brand, @type, @year, @price, @fuel, @power, @image, @description)
`);

const currentCarCount = db.prepare("SELECT COUNT(*) AS count FROM cars").get().count;
if (currentCarCount < 200) {
  const insertMany = db.transaction((cars) => {
    for (const car of cars) insertCar.run(car);
  });

  const seedCars = buildCatalogSeed();
  const missingCars = seedCars.slice(0, Math.max(0, 200 - currentCarCount));
  if (missingCars.length > 0) {
    insertMany(missingCars);
  }
}

const allowedTypes = new Set([
  "economy", "luxury", "suv", "sport", "electric"
]);

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function requireVisitor(req, res, next) {
  const visitorId = req.get("x-visitor-id");

  if (
    typeof visitorId !== "string" ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(visitorId)
  ) {
    return res.status(400).json({
      error: "ვიზიტორის იდენტიფიკატორი არასწორია."
    });
  }

  req.visitorId = visitorId;
  next();
}

function requireAuth(req, res, next) {
  const userId = Number(req.get("x-user-id"));
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(401).json({ error: "რეგისტრაცია აუცილებელია." });
  }

  const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(userId);
  if (!user) {
    return res.status(401).json({ error: "რეგისტრაცია აუცილებელია." });
  }

  req.user = user;
  next();
}

app.post("/api/register", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";

  if (!name || name.length > 80) {
    return res.status(400).json({ error: "სახელი უნდა შეიცავდეს 1-80 სიმბოლოს." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "ელ.ფოსტა არასწორია." });
  }

  if (password.length < 6 || password.length > 64) {
    return res.status(400).json({ error: "პაროლი უნდა იყოს 6-64 სიმბოლოს შორის." });
  }

  const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingUser) {
    return res.status(409).json({ error: "ეს ელ.ფოსტა უკვე რეგისტრირებულია." });
  }

  const result = db.prepare(`
    INSERT INTO users (name, email, password)
    VALUES (?, ?, ?)
  `).run(name, email, password);

  const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json({ success: true, user });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/cars", requireAuth, (req, res) => {
  const { type, search } = req.query;

  let sql = "SELECT * FROM cars WHERE 1=1";
  const params = {};

  if (type && type !== "all") {
    if (!allowedTypes.has(type)) {
      return res.status(400).json({ error: "ტიპი არასწორია." });
    }

    sql += " AND type = @type";
    params.type = type;
  }

  if (typeof search === "string" && search.trim()) {
    sql += " AND (name LIKE @search OR brand LIKE @search)";
    params.search = `%${search.trim().slice(0, 80)}%`;
  }

  sql += " ORDER BY id DESC";

  res.json(db.prepare(sql).all(params));
});

app.post("/api/cars", requireAuth, (req, res) => {
  const { name, brand, type, year, price, fuel, power, image, description } =
    req.body || {};

  if (
    ![name, brand, type, fuel, power, image, description].every(
      (value) => typeof value === "string" && value.trim()
    ) ||
    !allowedTypes.has(type) ||
    !Number.isInteger(Number(year)) ||
    Number(year) < 1950 ||
    Number(year) > 2100 ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0 ||
    !/^https?:\/\//i.test(image)
  ) {
    return res.status(400).json({
      error: "შეამოწმე მანქანის ყველა ველი."
    });
  }

  const result = insertCar.run({
    name: name.trim().slice(0, 100),
    brand: brand.trim().slice(0, 100),
    type,
    year: Number(year),
    price: Number(price),
    fuel: fuel.trim().slice(0, 60),
    power: power.trim().slice(0, 60),
    image: image.trim().slice(0, 1000),
    description: description.trim().slice(0, 1000)
  });

  res.status(201).json(
    db.prepare("SELECT * FROM cars WHERE id = ?").get(result.lastInsertRowid)
  );
});

app.post("/api/visitors", requireAuth, requireVisitor, (req, res) => {
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name || name.length > 80) {
    return res.status(400).json({
      error: "სახელი უნდა შეიცავდეს 1-80 სიმბოლოს."
    });
  }

  db.prepare(`
    INSERT INTO visitors (id, name)
    VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `).run(req.visitorId, name);

  res.json({ success: true, name });
});

app.get("/api/favorites", requireAuth, requireVisitor, (req, res) => {
  const cars = db.prepare(`
    SELECT cars.*
    FROM favorites
    JOIN cars ON cars.id = favorites.car_id
    WHERE favorites.visitor_id = ?
    ORDER BY favorites.id DESC
  `).all(req.visitorId);

  res.json(cars);
});

app.post("/api/favorites/:carId", requireAuth, requireVisitor, (req, res) => {
  const carId = Number(req.params.carId);

  if (!Number.isInteger(carId) || !db.prepare(
    "SELECT id FROM cars WHERE id = ?"
  ).get(carId)) {
    return res.status(404).json({ error: "მანქანა ვერ მოიძებნა." });
  }

  db.prepare(`
    INSERT OR IGNORE INTO favorites (visitor_id, car_id)
    VALUES (?, ?)
  `).run(req.visitorId, carId);

  res.json({ success: true });
});

app.delete("/api/favorites/:carId", requireAuth, requireVisitor, (req, res) => {
  db.prepare(`
    DELETE FROM favorites
    WHERE visitor_id = ? AND car_id = ?
  `).run(req.visitorId, Number(req.params.carId));

  res.json({ success: true });
});

app.post("/api/quiz-results", requireAuth, requireVisitor, (req, res) => {
  const { quizName, score, total } = req.body || {};

  if (
    typeof quizName !== "string" ||
    !["basics", "brands", "traffic", "expert"].includes(quizName) ||
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    total < 1 ||
    total > 30 ||
    score < 0 ||
    score > total
  ) {
    return res.status(400).json({
      error: "ტესტის შედეგი არასწორია."
    });
  }

  const result = db.prepare(`
    INSERT INTO quiz_results (visitor_id, quiz_name, score, total)
    VALUES (?, ?, ?, ?)
  `).run(req.visitorId, quizName, score, total);

  res.status(201).json({ success: true, id: result.lastInsertRowid });
});

app.get("/api/quiz-results", requireAuth, requireVisitor, (req, res) => {
  const results = db.prepare(`
    SELECT quiz_name, score, total, created_at
    FROM quiz_results
    WHERE visitor_id = ?
    ORDER BY id DESC
  `).all(req.visitorId);

  res.json(results);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AutoZone Georgia: http://localhost:${PORT}`);
  });
}

module.exports = { app, db };