const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//  login api

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordmatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordmatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "vamsi_krishna");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// authenticate Token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHead = request.headers["authorization"];
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (authHead === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "vamsi_krishna", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// get States Api

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT state_id as stateId,state_name as stateName,population FROM state;`;
  const getStates = await db.all(getStatesQuery);
  response.send(getStates);
});

//get state based on state id

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `SELECT state_id as stateId,state_name as stateName,population FROM state WHERE state_id = '${stateId}';`;
  const getStates = await db.all(getStatesQuery);
  console.log(getStates[0]);
  response.send(getStates[0]);
});

// create district in database

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths) 
    VALUES (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
        );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// get district based on districtId

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT district_id as districtId,district_name as districtName,state_id as stateId,cases,cured,active,deaths FROM district WHERE district_id = '${districtId}';`;
    const distr = await db.get(getDistrictQuery);
    response.send(distr);
  }
);

// delete district

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district where district_id = '${districtId}';`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//  update district

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district SET 
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}' WHERE district_id = '${districtId}';`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths FROM district WHERE state_id = '${stateId}' GROUP BY state_id;`;
    let valueStats = await db.get(getStatsQuery);
    response.send(valueStats);
  }
);

module.exports = app;
