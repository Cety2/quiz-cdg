const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path'); // 👈 AJOUT ICI

const app = express();
app.use(cors());
app.use(express.json());

// 👇 AJOUT ICI pour servir les fichiers HTML, CSS, JS du dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'quizdb',
    password: 'simplepassword',
    port: 5432,
});

app.post('/api/save-results', async (req, res) => {
    const { player, theme, score, total, answers } = req.body;

    try {
        const client = await pool.connect();

        await client.query(
            'INSERT INTO quiz_results(player, theme, score, total, created_at) VALUES($1, $2, $3, $4, NOW())',
            [player, theme, score, total]
        );

        for (const ans of answers) {
            await client.query(
                'INSERT INTO quiz_answers(player, theme, question, user_answer, correct_answer, is_correct, created_at) VALUES($1, $2, $3, $4, $5, $6, NOW())',
                [player, theme, ans.question, ans.userAnswer, ans.correctAnswer, ans.isCorrect]
            );
        }

        client.release();
        res.json({ status: 'ok' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(3000, () => console.log('Serveur démarré sur http://localhost:3000'));


app.get('/api/get-results', async (req, res) => {
    try {
        const client = await pool.connect();

        const resultQuizzes = await client.query('SELECT * FROM quiz_results ORDER BY created_at DESC');
        const resultAnswers = await client.query('SELECT * FROM quiz_answers');

        // Regrouper les réponses par joueur + thème + date (approximatif pour regroupement simple)
        const grouped = resultQuizzes.rows.map(row => {
            const answers = resultAnswers.rows.filter(ans =>
                ans.player === row.player &&
                ans.theme === row.theme
            );
            return {
                id: row.id,
                player: row.player,
                date: row.created_at.toISOString().split('T')[0],
                theme: row.theme,
                score: row.score,
                total: row.total,
                timeElapsed: 'NC', // tu peux ajouter un champ si tu l’as
                answers: answers.map(a => ({
                    question: a.question,
                    userAnswer: a.user_answer,
                    correctAnswer: a.correct_answer,
                    isCorrect: a.is_correct
                }))
            };
        });

        client.release();
        res.json(grouped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la lecture des résultats' });
    }
});
