import dotenv from "dotenv";
dotenv.config();

import pkg from "pg";
const { Client } = pkg;
const conn = new Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

//console.log("DB_USER:", process.env.DB_USER, "DB_PASSWORD type:", typeof process.env.DB_PASSWORD, process.env);
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
    console.log(process.env.DB_HOST); 
    app.listen(process.env.PORT,function(req,res){
        
        console.log("server started at ",process.env.PORT)
    ;});
}

export {app,startserver,closeConnection,conn};
//closeConnection();

