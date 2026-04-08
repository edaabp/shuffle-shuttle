require("dotenv").config();

const express = require("express");
const SpotifyWebApi = require("spotify-web-api-node");
const axios = require("axios");

const app = express();

let accessToken = "";

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

console.log("Client ID:", process.env.SPOTIFY_CLIENT_ID);
console.log("Redirect URI:", process.env.SPOTIFY_REDIRECT_URI);


// LANDING PAGE
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>

<head>

<title>Shuffle Shuttle</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

body{
margin:0;
font-family:Arial, Helvetica, sans-serif;
background:linear-gradient(180deg,#121212,#000);
color:white;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
}

.container{
text-align:center;
width:90%;
max-width:450px;
}

.logo{
font-size:36px;
font-weight:bold;
margin-bottom:10px;
}

.subtitle{
color:#aaa;
margin-bottom:25px;
}

.button{
padding:14px 30px;
border:none;
border-radius:50px;
background:#1DB954;
color:white;
font-weight:bold;
font-size:16px;
cursor:pointer;
}

.button:hover{
background:#1ed760;
}

.features{
margin-top:30px;
color:#aaa;
font-size:14px;
}

</style>

</head>

<body>

<div class="container">

<div class="logo">🎧 Shuffle Shuttle</div>

<div class="subtitle">
Shuffle your Spotify playlists instantly
</div>

<a href="/login">
<button class="button">
Connect Spotify Account
</button>
</a>

<div class="features">
✨ Shuffle playlists  
⚡ Instant reorder  
🎵 Multiple playlists
</div>

</div>

</body>

</html>
`);
});


// LOGIN
app.get("/login", (req, res) => {

  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-read-playback-state",
    "user-read-currently-playing",
    "user-modify-playback-state",
    "playlist-modify-private",
    "playlist-modify-public"
  ];

  res.redirect(
    spotifyApi.createAuthorizeURL(scopes, "shuffle-shuttle", true)
  );
});


// CALLBACK
app.get("/callback", async (req, res) => {
  try {

    const code = req.query.code;
    const data = await spotifyApi.authorizationCodeGrant(code);

    accessToken = data.body.access_token;
    spotifyApi.setAccessToken(accessToken);

    res.redirect("/app");

  } catch (err) {
    res.send("Login error");
  }
});


// APP UI
app.get("/app", (req, res) => {

res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Shuffle Shuttle</title>

<style>
body{
background:#121212;
color:white;
font-family:Arial;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
margin:0;
}

.container{
width:400px;
}

textarea{
width:100%;
height:100px;
margin-bottom:10px;
}

button{
width:100%;
padding:12px;
background:#1DB954;
border:none;
border-radius:30px;
color:white;
font-weight:bold;
}
</style>

</head>

<body>

<div class="container">

<h2>Shuffle Playlist</h2>

<form action="/shuffle">

<textarea name="playlist"></textarea>

<button>Shuffle</button>

</form>

</div>

</body>
</html>
`);
});


// SHUFFLE
app.get("/shuffle", async (req, res) => {
try{

const playlistUrl = req.query.playlist;

const playlistId = playlistUrl.split("/playlist/")[1].split("?")[0];

let tracks=[];
let url=`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

while(url){
const response=await axios.get(url,{
headers:{
Authorization:`Bearer ${accessToken}`
}
});

tracks=tracks.concat(response.data.items);
url=response.data.next;
}

let uris=tracks.map(t=>t.track.uri);

uris.sort(()=>Math.random()-0.5);

await axios.put(
`https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
{
uris:uris
},
{
headers:{
Authorization:`Bearer ${accessToken}`
}
}
);

res.send("Playlist shuffled 🎧");

}catch(err){
console.log(err);
res.send("Error shuffling");
}

});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});