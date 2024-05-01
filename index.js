const express = require('express');
const bodyParser = require('body-parser');
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbPath = path.join(__dirname, "tasks.db");

let db = null;
const initializeDBAndServer = async() => {
    try{
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        app.listen(4000, ()=>{
            console.log("listening to port 4000");
        });

    }catch(e){
        console.log(`DB Error: ${e.message}`);
        process.exit(1);
    }
}
initializeDBAndServer();

const authenticationToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined){
        jwtToken = authHeader.split(" ")[1]
    }
    if (jwtToken === undefined){
        response.status(400);
        response.send("Invalid JWT Token");
    }
    else{
        jwt.verify(jwtToken, "MY_ACCESS_TOKEN", async (error, payload)=>{
            if (error){
                response.status(400);
                response.send("Invalid JWT Token");
            }
            else{
                request.username = payload.username;
                next();
            }
        });
    }
}

app.post('/register/', async (request, response) => {
    const { username, password_hash } = request.body;
    const userExistsQuery = `
      SELECT
      *
      FROM users
      WHERE username = '${username}';
    `;
    const queryResults = await db.get(userExistsQuery);
    const hashedPassword = await bcrypt.hash(password_hash, 10);
    if (queryResults === undefined){
        const addUserQuery = `
        INSERT INTO Users(username, password_hash)
        VALUES ('${username}', '${hashedPassword}');
        `;
        await db.run(addUserQuery);
        response.send("User Created Successfully");
    }
    else{
        response.status(400);
        response.send('User already exists');
    }
});

app.post("/login/", async (request, response) => {
    const {username, password_hash} = request.body;
    const userExistsQuery = `
    SELECT
    *
    FROM Users
    WHERE username = '${username}';
    `;
    const userExistsQueryResult = await db.get(userExistsQuery);
    if (userExistsQueryResult === undefined){
        response.status(400);
        response.send("Invalid Username");
    }
    else{
        const comparePassword = await bcrypt.compare(password_hash, userExistsQueryResult.password_hash);
        if (comparePassword === true){
            const payload = {username: username}
            const jwtToken = jwt.sign(payload, "MY_ACCESS_TOKEN");
            response.send({jwtToken});
            console.log(jwtToken);
        }
        else{
            response.status(400);
            response.send("Invalid Password");
        }
    }
});

app.get("/tasks/", authenticationToken, async (request, response) =>{
    const getAllTasksQuery = `
    SELECT
    *
    FROM Tasks;
    `;
    const getAllTasksQueryResult = await db.all(getAllTasksQuery);
    response.send(getAllTasksQueryResult);

});

app.get("/tasks/:id/", authenticationToken, async (request, response) => {
    const {id} = request.params;
    const getSingleTaskQuery = `
    SELECT
    *
    FROM Tasks
    WHERE id = ${id};
    `;
    const getSingleTaskQueryResult = await db.get(getSingleTaskQuery);
    response.send(getSingleTaskQueryResult);

});

app.delete("/tasks/:id/", authenticationToken, async (request, response)=>{
    const {id} = request.params;
    const deleteSingleTaskQuery = `
    DELETE FROM Tasks
    WHERE id = ${id};
    `;
    await db.run(deleteSingleTaskQuery);
    response.send("Task Deleted Successfully");
})

app.post("/tasks/", authenticationToken, async (request, response) => {
    const {title, description, status, assignee_id, created_at, updated_at} = request.body;
    const addTaskQuery = `
    INSERT INTO
    Tasks(title, description, status, assignee_id, created_at, updated_at)
    VALUES
    ('${title}', '${description}', '${status}', ${assignee_id}, '${created_at}, '${updated_at}');
    `;
    await db.run(addTaskQuery);
    response.send("Task Added Successfully");

});

app.put("/tasks/:id/", authenticationToken,  async (request, response) => {
    const {id} = request.params;
    const {title, description, status, assignee_id, created_at, updated_at} = request.body;
    const updateTaskQuery = `
    UPDATE Tasks
    SET title='${title}', description = '${description}', status = '${status}', assignee_id = ${assignee_id}, created_at = '${created_at}', updated_at = '${updated_at}'
    WHERE id = ${id}; 
    `;
    await db.run(updateTaskQuery);
    response.send("Task Updated Successfully");

});