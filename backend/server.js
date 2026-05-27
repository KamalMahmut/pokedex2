const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_this";

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "pokedex",
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true
});

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function cleanUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at
  };
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function optionalAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    req.user = null;
  }

  next();
}

function authRequired(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: "Please log in first." });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired login token." });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access is required." });
  }

  next();
}

function normalisePokemonIds(pokemonIds) {
  if (!Array.isArray(pokemonIds)) return [];

  return [...new Set(
    pokemonIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function makeTeamSignature(pokemonIds) {
  return [...pokemonIds].sort((a, b) => a - b).join("-");
}

async function getTeamsByQuery(sql, params) {
  const [rows] = await db.execute(sql, params);
  const teamsById = new Map();

  for (const row of rows) {
    if (!teamsById.has(row.team_id)) {
      teamsById.set(row.team_id, {
        id: row.team_id,
        user_id: row.user_id,
        username: row.username,
        team_name: row.team_name,
        team_signature: row.team_signature,
        is_public: Boolean(row.is_public),
        created_at: row.created_at,
        updated_at: row.updated_at,
        pokemon: []
      });
    }

    if (row.pokemon_id) {
      teamsById.get(row.team_id).pokemon.push({
        id: row.pokemon_id,
        name: row.pokemon_name,
        type1: row.type1,
        type2: row.type2,
        image_url: row.image_url,
        slot_order: row.slot_order
      });
    }
  }

  return Array.from(teamsById.values());
}

app.get("/", (req, res) => {
  res.json({ message: "Pokedex Assignment 2 backend is running." });
});

// -------------------- Auth --------------------

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const [existing] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) {
      return res.status(409).json({ error: "This email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [countRows] = await db.execute("SELECT COUNT(*) AS count FROM users");
    const role = countRows[0].count === 0 ? "admin" : "user";

    const [result] = await db.execute(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [username.trim(), email.trim().toLowerCase(), passwordHash, role]
    );

    const user = {
      id: result.insertId,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      role
    };

    res.status(201).json({
      message: role === "admin" ? "Registered successfully. This first account is admin." : "Registered successfully.",
      token: createToken(user),
      user
    });
  } catch (error) {
    console.error("Register failed:", error);
    res.status(500).json({ error: "Register failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({
      message: "Logged in successfully.",
      token: createToken(user),
      user: cleanUser(user)
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, username, email, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    console.error("Fetch current user failed:", error);
    res.status(500).json({ error: "Could not fetch current user." });
  }
});

// -------------------- Pokemon --------------------

app.get("/api/pokemon", optionalAuth, async (req, res) => {
  try {
    let rows;

    if (req.user) {
      [rows] = await db.execute(
        `SELECT p.id, p.name, p.type1, p.type2, p.image_url, p.description,
                COALESCE(ups.viewed, p.viewed, 0) AS viewed
         FROM pokemon p
         LEFT JOIN user_pokemon_status ups
           ON ups.pokemon_id = p.id AND ups.user_id = ?
         ORDER BY p.id ASC`,
        [req.user.id]
      );
    } else {
      [rows] = await db.execute("SELECT * FROM pokemon ORDER BY id ASC");
    }

    res.json(rows.map((row) => ({ ...row, viewed: Boolean(row.viewed) })));
  } catch (error) {
    console.error("Failed to fetch pokemon:", error);
    res.status(500).json({ error: "Failed to fetch pokemon." });
  }
});

app.get("/api/pokemon/:id", optionalAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    let rows;
    if (req.user) {
      [rows] = await db.execute(
        `SELECT p.id, p.name, p.type1, p.type2, p.image_url, p.description,
                COALESCE(ups.viewed, p.viewed, 0) AS viewed
         FROM pokemon p
         LEFT JOIN user_pokemon_status ups
           ON ups.pokemon_id = p.id AND ups.user_id = ?
         WHERE p.id = ?`,
        [req.user.id, id]
      );
    } else {
      [rows] = await db.execute("SELECT * FROM pokemon WHERE id = ?", [id]);
    }

    if (!rows.length) {
      return res.status(404).json({ error: "Pokemon not found." });
    }

    res.json({ ...rows[0], viewed: Boolean(rows[0].viewed) });
  } catch (error) {
    console.error("Failed to fetch pokemon detail:", error);
    res.status(500).json({ error: "Failed to fetch pokemon detail." });
  }
});

app.post("/api/pokemon", authRequired, adminRequired, async (req, res) => {
  try {
    const { name, type1, type2, image_url, description } = req.body;

    if (!name || !type1) {
      return res.status(400).json({ error: "Name and primary type are required." });
    }

    const [result] = await db.execute(
      `INSERT INTO pokemon (name, type1, type2, image_url, description, viewed)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [name.trim(), type1.trim().toLowerCase(), type2 ? type2.trim().toLowerCase() : null, image_url || null, description || null]
    );

    res.status(201).json({ message: "Pokemon added successfully.", id: result.insertId });
  } catch (error) {
    console.error("Failed to add pokemon:", error);
    res.status(500).json({ error: "Failed to add pokemon." });
  }
});

app.put("/api/pokemon/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, type1, type2, image_url, description } = req.body;

    if (!name || !type1) {
      return res.status(400).json({ error: "Name and primary type are required." });
    }

    const [result] = await db.execute(
      `UPDATE pokemon
       SET name = ?, type1 = ?, type2 = ?, image_url = ?, description = ?
       WHERE id = ?`,
      [name.trim(), type1.trim().toLowerCase(), type2 ? type2.trim().toLowerCase() : null, image_url || null, description || null, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Pokemon not found." });
    }

    res.json({ message: "Pokemon updated successfully." });
  } catch (error) {
    console.error("Failed to update pokemon:", error);
    res.status(500).json({ error: "Failed to update pokemon." });
  }
});

app.put("/api/pokemon/:id/viewed", authRequired, async (req, res) => {
  try {
    const pokemonId = Number(req.params.id);
    const viewed = req.body.viewed ? 1 : 0;

    const [exists] = await db.execute("SELECT id FROM pokemon WHERE id = ?", [pokemonId]);
    if (!exists.length) {
      return res.status(404).json({ error: "Pokemon not found." });
    }

    await db.execute(
      `INSERT INTO user_pokemon_status (user_id, pokemon_id, viewed)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE viewed = VALUES(viewed), updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, pokemonId, viewed]
    );

    res.json({ message: "Viewed status updated successfully." });
  } catch (error) {
    console.error("Failed to update viewed status:", error);
    res.status(500).json({ error: "Failed to update viewed status." });
  }
});

app.delete("/api/pokemon/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await db.execute("DELETE FROM pokemon WHERE id = ?", [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Pokemon not found." });
    }

    res.json({ message: "Pokemon deleted successfully." });
  } catch (error) {
    console.error("Failed to delete pokemon:", error);
    res.status(500).json({ error: "Failed to delete pokemon." });
  }
});

// Backwards-compatible read route for the old frontend.
app.get("/pokemon", optionalAuth, async (req, res) => {
  try {
    let rows;

    if (req.user) {
      [rows] = await db.execute(
        `SELECT p.id, p.name, p.type1, p.type2, p.image_url, p.description,
                COALESCE(ups.viewed, p.viewed, 0) AS viewed
         FROM pokemon p
         LEFT JOIN user_pokemon_status ups
           ON ups.pokemon_id = p.id AND ups.user_id = ?
         ORDER BY p.id ASC`,
        [req.user.id]
      );
    } else {
      [rows] = await db.execute("SELECT * FROM pokemon ORDER BY id ASC");
    }

    res.json(rows.map((row) => ({ ...row, viewed: Boolean(row.viewed) })));
  } catch (error) {
    console.error("Failed to fetch pokemon:", error);
    res.status(500).json({ error: "Failed to fetch pokemon." });
  }
});

// -------------------- Teams --------------------

app.post("/api/teams", authRequired, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { team_name, pokemon_ids, is_public } = req.body;
    const pokemonIds = normalisePokemonIds(pokemon_ids);

    if (!team_name || !team_name.trim()) {
      return res.status(400).json({ error: "Team name is required." });
    }

    if (pokemonIds.length < 1 || pokemonIds.length > 6) {
      return res.status(400).json({ error: "A team must contain between 1 and 6 Pokemon." });
    }

    const [validPokemon] = await connection.query("SELECT id FROM pokemon WHERE id IN (?)", [pokemonIds]);
    if (validPokemon.length !== pokemonIds.length) {
      return res.status(400).json({ error: "One or more Pokemon IDs are invalid." });
    }

    const signature = makeTeamSignature(pokemonIds);

    await connection.beginTransaction();

    const [teamResult] = await connection.execute(
      `INSERT INTO teams (user_id, team_name, team_signature, is_public)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, team_name.trim(), signature, is_public === false ? 0 : 1]
    );

    const teamId = teamResult.insertId;

    for (let index = 0; index < pokemonIds.length; index += 1) {
      await connection.execute(
        "INSERT INTO team_members (team_id, pokemon_id, slot_order) VALUES (?, ?, ?)",
        [teamId, pokemonIds[index], index + 1]
      );
    }

    await connection.commit();
    res.status(201).json({ message: "Team saved successfully.", id: teamId });
  } catch (error) {
    await connection.rollback();
    console.error("Failed to save team:", error);
    res.status(500).json({ error: "Failed to save team." });
  } finally {
    connection.release();
  }
});

app.get("/api/teams/my", authRequired, async (req, res) => {
  try {
    const teams = await getTeamsByQuery(
      `SELECT t.id AS team_id, t.user_id, u.username, t.team_name, t.team_signature,
              t.is_public, t.created_at, t.updated_at,
              tm.slot_order, p.id AS pokemon_id, p.name AS pokemon_name,
              p.type1, p.type2, p.image_url
       FROM teams t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN pokemon p ON p.id = tm.pokemon_id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC, tm.slot_order ASC`,
      [req.user.id]
    );

    res.json(teams);
  } catch (error) {
    console.error("Failed to fetch my teams:", error);
    res.status(500).json({ error: "Failed to fetch my teams." });
  }
});

app.put("/api/teams/:id", authRequired, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const teamId = Number(req.params.id);
    const { team_name, pokemon_ids, is_public } = req.body;

    const [teamRows] = await connection.execute("SELECT * FROM teams WHERE id = ?", [teamId]);
    const team = teamRows[0];

    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    if (team.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "You can only edit your own team." });
    }

    const pokemonIds = pokemon_ids ? normalisePokemonIds(pokemon_ids) : null;

    if (pokemonIds && (pokemonIds.length < 1 || pokemonIds.length > 6)) {
      return res.status(400).json({ error: "A team must contain between 1 and 6 Pokemon." });
    }

    if (pokemonIds) {
      const [validPokemon] = await connection.query("SELECT id FROM pokemon WHERE id IN (?)", [pokemonIds]);
      if (validPokemon.length !== pokemonIds.length) {
        return res.status(400).json({ error: "One or more Pokemon IDs are invalid." });
      }
    }

    await connection.beginTransaction();

    const newName = team_name && team_name.trim() ? team_name.trim() : team.team_name;
    const newIsPublic = typeof is_public === "boolean" ? (is_public ? 1 : 0) : team.is_public;
    const newSignature = pokemonIds ? makeTeamSignature(pokemonIds) : team.team_signature;

    await connection.execute(
      `UPDATE teams
       SET team_name = ?, is_public = ?, team_signature = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newName, newIsPublic, newSignature, teamId]
    );

    if (pokemonIds) {
      await connection.execute("DELETE FROM team_members WHERE team_id = ?", [teamId]);

      for (let index = 0; index < pokemonIds.length; index += 1) {
        await connection.execute(
          "INSERT INTO team_members (team_id, pokemon_id, slot_order) VALUES (?, ?, ?)",
          [teamId, pokemonIds[index], index + 1]
        );
      }
    }

    await connection.commit();
    res.json({ message: "Team updated successfully." });
  } catch (error) {
    await connection.rollback();
    console.error("Failed to update team:", error);
    res.status(500).json({ error: "Failed to update team." });
  } finally {
    connection.release();
  }
});

app.delete("/api/teams/:id", authRequired, async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const [teamRows] = await db.execute("SELECT * FROM teams WHERE id = ?", [teamId]);
    const team = teamRows[0];

    if (!team) {
      return res.status(404).json({ error: "Team not found." });
    }

    if (team.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "You can only delete your own team." });
    }

    await db.execute("DELETE FROM teams WHERE id = ?", [teamId]);
    res.json({ message: "Team deleted successfully." });
  } catch (error) {
    console.error("Failed to delete team:", error);
    res.status(500).json({ error: "Failed to delete team." });
  }
});

app.get("/api/teams/popular", optionalAuth, async (req, res) => {
  try {
    const [popularRows] = await db.execute(
      `SELECT team_signature,
              COUNT(*) AS total_saves,
              COUNT(DISTINCT user_id) AS user_count,
              MIN(id) AS sample_team_id
       FROM teams
       WHERE is_public = 1
       GROUP BY team_signature
       ORDER BY user_count DESC, total_saves DESC, team_signature ASC
       LIMIT 10`
    );

    if (!popularRows.length) {
      return res.json([]);
    }

    const sampleIds = popularRows.map((row) => row.sample_team_id);
    const [memberRows] = await db.query(
      `SELECT tm.team_id, tm.slot_order, p.id, p.name, p.type1, p.type2, p.image_url
       FROM team_members tm
       JOIN pokemon p ON p.id = tm.pokemon_id
       WHERE tm.team_id IN (?)
       ORDER BY tm.team_id ASC, tm.slot_order ASC`,
      [sampleIds]
    );

    const membersByTeam = new Map();
    for (const member of memberRows) {
      if (!membersByTeam.has(member.team_id)) membersByTeam.set(member.team_id, []);
      membersByTeam.get(member.team_id).push({
        id: member.id,
        name: member.name,
        type1: member.type1,
        type2: member.type2,
        image_url: member.image_url,
        slot_order: member.slot_order
      });
    }

    const popularTeams = popularRows.map((row) => ({
      team_signature: row.team_signature,
      total_saves: Number(row.total_saves),
      user_count: Number(row.user_count),
      sample_team_id: row.sample_team_id,
      pokemon: membersByTeam.get(row.sample_team_id) || []
    }));

    res.json(popularTeams);
  } catch (error) {
    console.error("Failed to fetch popular teams:", error);
    res.status(500).json({ error: "Failed to fetch popular teams." });
  }
});

// -------------------- Admin --------------------

app.get("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
              COUNT(DISTINCT t.id) AS team_count
       FROM users u
       LEFT JOIN teams t ON t.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

app.get("/api/admin/teams", authRequired, adminRequired, async (req, res) => {
  try {
    const teams = await getTeamsByQuery(
      `SELECT t.id AS team_id, t.user_id, u.username, t.team_name, t.team_signature,
              t.is_public, t.created_at, t.updated_at,
              tm.slot_order, p.id AS pokemon_id, p.name AS pokemon_name,
              p.type1, p.type2, p.image_url
       FROM teams t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN pokemon p ON p.id = tm.pokemon_id
       ORDER BY t.created_at DESC, tm.slot_order ASC`,
      []
    );

    res.json(teams);
  } catch (error) {
    console.error("Failed to fetch admin teams:", error);
    res.status(500).json({ error: "Failed to fetch admin teams." });
  }
});


app.put("/api/admin/users/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { username, role } = req.body;

    if (userId === req.user.id && role && role !== "admin") {
      return res.status(400).json({ error: "You cannot remove your own admin role." });
    }

    const [rows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
    const existing = rows[0];

    if (!existing) {
      return res.status(404).json({ error: "User not found." });
    }

    const nextUsername = username && username.trim() ? username.trim() : existing.username;
    const nextRole = role === "admin" || role === "user" ? role : existing.role;

    await db.execute(
      "UPDATE users SET username = ?, role = ? WHERE id = ?",
      [nextUsername, nextRole, userId]
    );

    res.json({ message: "User updated successfully." });
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user." });
  }
});

app.delete("/api/admin/users/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account here." });
    }

    const [result] = await db.execute("DELETE FROM users WHERE id = ?", [userId]);

    if (!result.affectedRows) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user." });
  }
});

// -------------------- Error handling --------------------

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.listen(PORT, async () => {
  try {
    await db.query("SELECT 1");
    console.log("Connected to MySQL.");
  } catch (error) {
    console.error("MySQL connection test failed:", error.message);
  }

  console.log(`Server is running at http://localhost:${PORT}`);
});
