import  express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { app, startserver, closeConnection, conn} from "./server.js";

await startserver();

app.use(express.json());

//for token verification
app.use(async (req,res,next) => {
    const skippaths = ["/","/auth/signup","/auth/signin"]
    console.log(req.path)
    if(skippaths.includes(req.path) ){
        console.log("auth skipping the token verification.")
        return next();
    }
     const auth = req.headers.authorization;
    if(auth){
        const token  = auth.substring(7);
            if(!token){
        return res.status(400).send("no token provided.")
    }
    try{
        console.log(token)
        const payload = jwt.verify(token,process.env.KEY);
        const query = 'SELECT id FROM public."Users" WHERE username = $1';
        try{
            const ret = await conn.query(query,[payload.username]);
            if(ret.rowCount === 0) return res.status(401).send("Invalid token user");
            req.id = ret.rows[0].id;
            next();

        }
        catch(error){
            return res.status(401).send("database error" + error);
        }
    }
    catch(error){
        res.status(400).send("Token invalid or expired"+ error)
    }

    }
    else {
        return res.status(400).send("No token provided");
    }
})

app.use("/notes/:id", async (req,res,next) => {
    console.log(req.path ," and ",req.method)
    if( req.method === 'PUT'){
        console.log("skipping middelware")
        return next();
    }
    const query1 = 'SELECT userid from public."Notes" WHERE noteid = $1';
    try{
        const owner = await conn.query(query1,[req.params.id])
        if(owner.rowCount == 0){
            return res.status(400).send("No notes found.")
        }
        else if(owner.rows[0].userid == req.id){
            next();
        }
        else {
            return res.status(403).send("You don't have required permissions for this note.")
        }
    }
    catch(error){
        return res.status(500).send("Internal server error")
    }
} )

app.get("/",(req,res) => {
    res.status(200).send("Welcome! This is the Home page of NoteMaker")
});


app.post("/auth/signup",async (req,res) => {
    const username = req.body.username;
    const pwd = req.body.password;
    const reshash = await bcrypt.hash(pwd,12)
    const query = `
    INSERT INTO public."Users"(username, password, created_at) VALUES ($1, $2, NOW()) RETURNING id, username, created_at`;
    const values = [username, reshash];

    try{
    // Execute query
        const ret = await conn.query(query, values);

        console.log("User signed up:", ret.rows[0]);
        res.status(200).send("user signedup successfully");
    }
    catch(error){
        console.log("error signing up");
        res.status(500).send("internal server error is"+ error);
    }
});

app.post("/auth/signin", async (req,res) => {
    const uname = req.body.username;
    const pwd = req.body.password;
    //verify if credentials are right
    const query = `
    SELECT * FROM public."Users" where username = $1`;
    const values = [uname];
    try{
        const ret = await conn.query(query,values)
        console.log("return value is " , ret.rows[0], "for ",uname)
        if (ret.rowCount != 0){
            const matches = await bcrypt.compare(pwd,ret.rows[0].password);
            if(matches){
                const tokenval = jwt.sign({username: uname},process.env.KEY,{expiresIn: "1h"});
                res.json({token: tokenval})
            }
            else {
                res.status(400).send("Invalid credentials")
            }
        }
        else {
            res.status(400).send("No account exists with given username.")
        }
    }
    catch(error){
        console.log("probelm verifying credentials");
        res.status(500).send("probelm verifying credentials or database server issue ," + error)
    }
} )

app.post("/create",async (req,res) => {
    const title = req.body.title;
    const content = req.body.content;
    if(title && content){
        try{
                const query = `
        INSERT INTO public."Notes"(title,content,userid) VALUES ($1, $2, $3)`;
        const values = [title,content,req.id];
            await conn.query(query,values);
            res.status(200).send("successfully added notes.");
        }
        catch(error){
            res.status(500).send("cannot insert into db : "+ error)
        }
    }
    else {
        res.status(400).send("Send title and content")
    }
})

app.get("/notes",async (req,res) => {
  try{
    const query = `
        SELECT title,content FROM public."Notes" where userid = $1`;
        const values = [req.id];
        const result = await conn.query(query,values);
        console.log(result)
        res.status(200).json(result.rows);
    }  
    catch(error){
        res.status(400).send("error fetching notes" + error)
    }
})

app.get("/notes/:id",async (req,res) => {
  try{
    const query = `
        SELECT title,content FROM public."Notes" where userid = $1 and noteid = $2`;
        const values = [req.id, req.params.id];
        const result = await conn.query(query,values);
        //console.log("result")
        res.status(200).json(result.rows);
    }  
    catch(error){
        res.status(400).send("error fetching notes" + error)
    }
})


// should be able to edit own notes or shared notes with write permission.
app.put("/notes/:id", async (req, res) => {
    //check id is own id or shared with write permissions for me.
        const query1 = 'SELECT userid from public."Notes" WHERE noteid = $1';
        const query2 = `SELECT permission FROM public."notes_collaborators" WHERE userid = $1 and noteid = $2`
        try{
            const owner = await conn.query(query1,[req.params.id])
            const permission = await conn.query(query2,[req.id,req.params.id])
            if(owner.rowCount == 0){
                return res.status(400).send("No notes found.")
            }
            if(owner.rows[0].userid != req.id){
                if(permission.rowCount == 0 || permission.rows[0].permission != "write"){
                    return res.status(400).send("No permission to edit this notes")
                }
            }
            //now we have permission
        }
        catch(error){
            return res.status(500).send("Internal server error")
        }

    const noteId = req.params.id;          // path param
    const { title, content } = req.body;   // JSON body

    if (!title || !content) {
        return res.status(400).send("Send title and content");
    }

    try {
        const query = `
            UPDATE public."Notes"
            SET title = $1, content = $2
            WHERE noteid = $3
            RETURNING title,content;
        `;
        const values = [title, content, noteId];

        const result = await conn.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).send("Note not found");
        }

        res.json({ updated: result.rows[0] });
    } catch (error) {
        res.status(500).send("Cannot update note: " + error.message);
    }
});

// Example: DELETE /notes/42
app.delete("/notes/:id", async (req, res) => {
    const noteId = req.params.id;  // get path param

    try {
        const query = `
            DELETE FROM public."Notes"
            WHERE noteid = $1
            RETURNING title, content;
        `;
        const values = [noteId];

        const result = await conn.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).send("Note not found");
        }

        res.json({ deleted: result.rows[0] });
    } catch (error) {
        res.status(500).send("Cannot delete note: " + error.message);
    }
});

app.post("/notes/:id/shared",async (req, res) => {
    const noteid = req.params.id;
    const sharewitharray = req.body.share
    if(sharewitharray && sharewitharray.length > 0){
        await conn.query('BEGIN')
        try{
            for (let x of sharewitharray ){
                const username = x.username;
                const ret = await conn.query('SELECT id FROM public."Users" WHERE username = $1', [username]);
                if(ret.rowCount === 0) throw new Error("User not found");
                console.log(ret)
                const userid = ret.rows[0].id;
                const permission = x.permission;
                const query2 = 'INSERT INTO public."notes_collaborators"(noteid, userid, permission) VALUES ($1, $2, $3)'
                const values = [noteid, userid, permission];
                await conn.query(query2,values);
            }
            await conn.query('COMMIT')
        }
        catch(error){
            await conn.query('ROLLBACK')
            return res.status(400).send("issue adding permissions" + error);
        }
        
        res.status(200).send("successfully added permissions.") 
    }
    else{
        return res.status(400).send("No list provided.");
    }

})

app.delete("/notes/:id/shared",async (req, res) => {
        const usernames = req.body.usernames
        if(usernames && usernames.length > 0){
            await conn.query('BEGIN')
                try{
                    for (let x of usernames ){
                        const username = x.username;
                        const ret = await conn.query('SELECT id FROM public."Users" WHERE username = $1', [username]);
                        if(ret.rowCount === 0) throw new Error("User not found");
                        const query2 = 'DELETE FROM public."notes_collaborators" where noteid = $1 and userid = $2'
                        const values = [req.params.id, ret.rows[0].id];
                        await conn.query(query2,values);
                    }
                await conn.query('COMMIT')
                }
                catch(error){
                    await conn.query('ROLLBACK')
                    return res.status(400).send("issue deleting permissions" + error);
                }
                res.status(200).send("successfully deleted permissions.")
        }
        else{
            return res.status(400).send("No list provided.");
        }
})

app.get("/notes/:id/shared",async (req, res) => {
            try{
                const query2 = 'SELECT u.username as username, nc.permission as permission FROM public."notes_collaborators" as nc JOIN public."Users" as u on nc.userid = u.id where nc.noteid = $1'
                const values = [req.params.id];
                const result = await conn.query(query2,values);
                res.status(200).send(result.rows)
            }
            catch(error){
                return res.status(500).send("issue fetching collaborator details" + error);
            }
})

app.get("/shared", async(req,res) => {
    try{
        const query = `SELECT n.title, n.content FROM public."notes_collaborators" AS nc JOIN public."Notes" as n ON nc.noteid = n.noteid WHERE nc.userid = $1`;
        const values = [req.id]
        const result = await conn.query(query,values);
                res.status(200).send(result.rows)
            }
        catch(error){
                return res.status(400).send("issue fetching notes shared with you" + error);
        }

})
