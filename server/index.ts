import express from 'express'
import cors from 'cors'


const app = express();
app.use(cors());

const port = 5001;

app.get('/api/health', (req, res) => {
    res.send("API is running");
});

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});

