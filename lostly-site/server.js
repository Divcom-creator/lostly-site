const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Servir les fichiers du site
app.use(express.static(__dirname));

// Démarrer le serveur
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lostly fonctionne sur le port ${PORT}`);
});
