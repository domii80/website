const express = require('express');
const app = express();
const port = 3000;

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Welcome to noetel.info</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f4f4f9; }
        h1 { color: #333; }
        p { color: #666; }
    </style>
</head>
<body>
    <h1>Welcome to noetel.info</h1>
    <p>Your secure site is live and protected by Let's Encrypt!</p>
</body>
</html>
`;

app.get('/', (req, res) => {
  res.send(htmlContent);
});

app.disable('x-powered-by');

app.listen(port, '127.0.0.1', () => {
  console.log(`App listening at http://127.0.0.1:\${port}`);
});
