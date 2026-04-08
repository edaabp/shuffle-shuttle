const express = require("express");
const SpotifyWebApi = require("spotify-web-api-node");
const axios = require("axios");

const app = express();

let accessToken = "";

const spotifyApi = new SpotifyWebApi({
  clientId: "89a65792e47a494da981def1dec1ea9d",
  clientSecret: "83ba22f498234179b83be6c6f69bac30",
  redirectUri: "http://127.0.0.1:3000/callback",
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


// CALLBACK UI
app.get("/callback", async (req, res) => {
  try {

    const code = req.query.code;
    const data = await spotifyApi.authorizationCodeGrant(code);

    accessToken = data.body.access_token;
    spotifyApi.setAccessToken(accessToken);

    res.send(`
<!DOCTYPE html>
<html>
<head>

<title>Shuffle Shuttle</title>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>

:root{
--bg:#121212;
--text:white;
--card:#1c1c1c;
}

.light{
--bg:#f5f5f5;
--text:#111;
--card:white;
}

body{
margin:0;
font-family:Arial;
background:var(--bg);
color:var(--text);
transition:0.3s;
}

.container{
max-width:500px;
margin:auto;
padding:20px;
}

.logo{
font-size:32px;
font-weight:bold;
text-align:center;
margin-bottom:10px;
}

.subtitle{
text-align:center;
color:gray;
margin-bottom:20px;
}

textarea{
width:100%;
padding:12px;
border-radius:8px;
border:none;
height:100px;
margin-bottom:15px;
}

button{
width:100%;
padding:14px;
border:none;
border-radius:50px;
background:#1DB954;
color:white;
font-weight:bold;
cursor:pointer;
}

.preview{
background:var(--card);
padding:12px;
border-radius:8px;
margin-top:10px;
display:flex;
align-items:center;
gap:10px;
}

.preview img{
width:60px;
height:60px;
border-radius:4px;
}

.toggle{
position:fixed;
top:15px;
right:15px;
cursor:pointer;
}

.history{
margin-top:20px;
font-size:12px;
}

.drop{
border:2px dashed gray;
padding:20px;
border-radius:8px;
text-align:center;
margin-bottom:10px;
}

</style>

</head>

<body>

<div class="toggle" onclick="toggleTheme()">🌙</div>

<div class="container">

<div class="logo">🎧 Shuffle Shuttle</div>

<div class="subtitle">Paste or drag playlists</div>

<div class="drop" id="drop">
Drag playlist here
</div>

<form action="/shuffle" method="get" onsubmit="saveHistory()">

<textarea id="playlist" name="playlist"></textarea>

<button>Shuffle Playlist</button>

</form>

<div class="history">
<h4>Recent</h4>
<div id="history"></div>
</div>

</div>

<script>

const drop = document.getElementById("drop")
const textarea = document.getElementById("playlist")

drop.addEventListener("dragover", e=>e.preventDefault())

drop.addEventListener("drop", e=>{
e.preventDefault()
textarea.value += e.dataTransfer.getData("text")
})

function toggleTheme(){
document.body.classList.toggle("light")
}

function saveHistory(){
localStorage.setItem("history",textarea.value)
}

document.getElementById("history").innerText =
localStorage.getItem("history") || ""

</script>

</body>
</html>
`);

  } catch (err) {
    res.send("Login error");
  }
});


// SHUFFLE
app.get("/shuffle", async (req, res) => {
  try {

    const playlistInput = req.query.playlist;

    const playlistUrls = playlistInput
      .split("\n")
      .map(p => p.trim())
      .filter(Boolean);

    let results = [];

    for (const playlistUrl of playlistUrls){

      const playlistId = playlistUrl.split("/playlist/")[1]?.split("?")[0];

      let tracks = [];
      let url = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50`;

      while (url) {
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        tracks = tracks.concat(response.data.items);
        url = response.data.next;
      }

      let uris = tracks
        .filter(t => t?.item?.uri)
        .map(t => t.item.uri);

      uris = [...new Set(uris)];
      uris.sort(() => Math.random() - 0.5);

      await axios.put(
        `https://api.spotify.com/v1/playlists/${playlistId}/items`,
        { uris: [] },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      for (let i = 0; i < uris.length; i += 100) {
        await axios.post(
          `https://api.spotify.com/v1/playlists/${playlistId}/items`,
          { uris: uris.slice(i, i + 100) },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            }
          }
        );
      }

      results.push(playlistId);
    }

    res.send(`
<!DOCTYPE html>
<html>

<head>

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Shuffle Shuttle</title>

<style>

body{
margin:0;
font-family:Arial;
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
max-width:420px;
}

.logo{
font-size:28px;
font-weight:bold;
margin-bottom:10px;
}

.success{
font-size:22px;
margin-bottom:20px;
}

.button{
margin-top:15px;
padding:14px 28px;
border:none;
border-radius:50px;
background:#1DB954;
color:white;
font-weight:bold;
cursor:pointer;
font-size:15px;
}

.button:hover{
background:#1ed760;
}

.link{
display:block;
margin-top:10px;
text-decoration:none;
}

</style>

</head>

<body>

<div class="container">

<div class="logo">🎧 Shuffle Shuttle</div>

<div class="success">
🎶 Playlist Shuffled
</div>

${results.map(id =>
`
<a class="link" href="https://open.spotify.com/playlist/${id}" target="_blank">
<button class="button">
Open Playlist
</button>
</a>
`
).join("")}

<a href="/callback" class="link">
<button class="button">
Shuffle Another
</button>
</a>

</div>

</body>

</html>
`);

  } catch (err) {
    res.send("Error");
  }
});

app.listen(3000, () => {
  console.log("Running on http://127.0.0.1:3000/login");
});