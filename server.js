import pkg from "pg";
const { Client } = pkg;
const conn = new Client({
  host: "localhost",
  user: "postgres",
  port: 5432,
  password: "psqlPass1.",
  database: "demodb"
});

import express from "express";
const app = express();


async function connectToDb(conn){
    try{
        const p = await conn.connect();
        console.log("connection established to db");
    }
    catch(error){
        console.log("there is an error establishing",error);
    }

}

async function closeConnection(conn){
    try{
        const p = await conn.end();
        console.log("connection closed to db");
    }
    catch(error){
        console.log("there is an error closing the connection",error);
    }
}


async function startserver(){
    await connectToDb(conn);

    app.listen(3000,function(req,res){
        
        console.log("server started at 3000")
    ;});
}

export {app,startserver,closeConnection,conn};
//closeConnection();

