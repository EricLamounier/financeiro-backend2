const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config()
const filePath = './texto.json';

const cors = require('cors');

app.use(bodyParser.json({ limit: '25mb' }));

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }));


const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWD,
  port: process.env.DB_PORT,
  /*ssl: {
    rejectUnauthorized: false
  }*/
});
/*
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'financeiro',
  password: 'root',
});*/

let imagemPadrao = null

const readJsonFile = async (filePath) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
          console.error("Erro ao ler o arquivo:", err);
          return;
      }
      try {
          const jsonData = JSON.parse(data);
          imagemPadrao = jsonData.largeText;
      } catch (error) {
          console.error("Erro ao parsear JSON:", error);
      }
  });
}

//readJsonFile(filePath)

pool.connect((err, client, release) => {
    if (err) {
      return console.error('Erro ao conectar ao banco de dados:', err.stack);
    }
    console.log('Conectado ao banco de dados!');
    release(); // Libera o cliente para o pool
});

// Cadastro de conta
app.post('/api/conta/post/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nome, valor, data, tipo, situacao, pessoa_id } = req.body;
    const result = await client.query(
      'INSERT INTO conta (nome, valor, data, tipo, situacao, pessoa_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nome, valor, data, tipo, situacao, pessoa_id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensagem: 'Erro ao inserir os dados!', erro: e.message });
  } finally {
    client.release();
  }
});

app.get('/x', (req, res)=>{
    res.json('d')
})

// Edição de conta
app.put('/api/conta/put/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nome, valor, data, tipo, situacao, pessoa_id } = req.body;
    const { id } = req.params;
    await client.query(
      'UPDATE conta SET nome = $1, valor = $2, data = $3, tipo = $4, situacao = $5 WHERE id = $6;',
      [nome, valor, data, tipo, situacao, id]
    );
    await client.query('COMMIT');
    const contaAtualizada = {
      id,
      nome,
      valor,
      data,
      tipo,
      situacao,
      pessoa_id
    };
    res.json({ conta: contaAtualizada });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensagem: 'Erro ao atualizar os dados!', erro: e.message });
  } finally {
    client.release();
  }
});

// Deletar conta
app.delete('/api/conta/delete/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    await client.query('DELETE FROM conta WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.sendStatus(204);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensagem: 'Erro ao deletar os dados!', erro: e.message });
  } finally {
    client.release();
  }
});

// Obter contas por pessoa_id
app.get('/api/conta/get/:pessoa_id', async (req, res) => {
  const { pessoa_id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM conta WHERE pessoa_id = $1', [pessoa_id]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ mensagem: 'Erro ao buscar os dados!', erro: e.message });
  }
});

// Obter todas as contas
app.get('/api/conta/get', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM conta');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ mensagem: 'Erro ao buscar os dados!', erro: e.message });
  }
});

// Obter todas as contas com pessoa_id null
app.get('/api/conta/get/contas-dividido', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM conta WHERE pessoa_id IS NULL');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ mensagem: 'Erro ao buscar os dados!', erro: e.message });
  }
});

// ------------------------------------------------------------ pessoas


// Cadastro de pessoa
app.post('/api/pessoa/post', async (req, res) => {
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let { nome, imagem } = req.body;

      let aux = imagem
      if(imagem)
          imagem = imagemPadrao

      const query = "INSERT INTO pessoa (nome, imagem) VALUES ($1, decode($2, 'base64')) RETURNING *";
      const result = await client.query(query, [nome, imagem]);

      const id = result.rows[0].id;
      await client.query('COMMIT');
      res.json({ id, nome, imagem: imagem });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ mensagem: 'Erro ao inserir os dados!', erro: e.message });
    } finally {
      client.release();
    }
  });
  
  // Listagem de pessoas
  app.get('/api/pessoa/get', async (req, res) => {
    
    try {
      const result = await pool.query("SELECT id, nome, encode(imagem, 'base64') as imagem FROM pessoa");
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ mensagem: 'Erro ao buscar as pessoas!', erro: e.message });
    }
  });
  
  // Edição de pessoa
  app.put('/api/pessoa/put/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { nome, imagem } = req.body;
      const { id } = req.params;

      const query = 'UPDATE pessoa SET nome = $1, imagem = decode($2, \'base64\') WHERE id = $3';
      await client.query(query, [nome, imagem, id]);
      await client.query('COMMIT');
      res.json({ nome, imagem, id });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ mensagem: 'Erro ao atualizar os dados!', erro: e.message });
    } finally {
      client.release();
    }
  });
  
  // Remoção de pessoa
  app.delete('/api/pessoa/delete/:id', async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = req.params;
      await client.query('DELETE FROM pessoa WHERE id = $1', [id]);
      await client.query('COMMIT');
      res.sendStatus(204);
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ mensagem: 'Erro ao deletar os dados!', erro: e.message });
    } finally {
      client.release();
    }
  });
  
  app.listen(3000, () => {
  console.log(`Servidor rodando na porta 3000`);
});
//module.exports = app;