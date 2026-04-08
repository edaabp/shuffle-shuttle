require("dotenv").config();

const express = require("express");
const SpotifyWebApi = require("spotify-web-api-node");
const axios = require("axios");

const app = express();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

console.log("Client ID:", process.env.SPOTIFY_CLIENT_ID);
console.log("Redirect URI:", process.env.SPOTIFY_REDIRECT_URI);


// Landing Page
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

    const accessToken = data.body.access_token;
    const refreshToken = data.body.refresh_token;

    res.redirect(`/app?token=${accessToken}&refresh=${refreshToken}`);

  } catch (err) {
    console.log(err);
    res.send("Login error");
  }
});



// APP UI
app.get("/app", (req, res) => {

  const token = req.query.token;
  const refresh = req.query.refresh;

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
padding:10px;
border-radius:10px;
border:none;
}

button{
width:100%;
padding:12px;
background:#1DB954;
border:none;
border-radius:30px;
color:white;
font-weight:bold;
cursor:pointer;
}

button:hover{
background:#1ed760;
}

</style>

</head>

<body>

<div class="container">

<h2>Shuffle Playlist</h2>

<form action="/shuffle">

<input type="hidden" name="token" value="${token}">
<input type="hidden" name="refresh" value="${refresh}">

<textarea name="playlist" placeholder="Paste Spotify Playlist URL"></textarea>

<button>Shuffle Playlist</button>

</form>

</div>

</body>
</html>

`);

});




// SHUFFLE
app.get("/shuffle", async (req, res) => {

  try {

    let accessToken = req.query.token;
    const refreshToken = req.query.refresh;
    const playlistUrl = req.query.playlist;

    // refresh token
    spotifyApi.setRefreshToken(refreshToken);

    const refresh = await spotifyApi.refreshAccessToken();

    accessToken = refresh.body.access_token;

    const playlistId = playlistUrl.split("/playlist/")[1].split("?")[0];

    // Get tracks
    let tracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    while (url) {

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      tracks = tracks.concat(response.data.items);

      url = response.data.next;

    }

    // Extract URIs
    let uris = tracks
      .filter(t => t.track && t.track.uri)
      .map(t => t.track.uri);

    // Shuffle
    uris.sort(() => Math.random() - 0.5);

    // Clear playlist
    await axios.put(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        uris: []
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Add shuffled tracks
    for (let i = 0; i < uris.length; i += 100) {

      await axios.post(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          uris: uris.slice(i, i + 100)
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

    }

    // Success Page
    res.send(`

<!DOCTYPE html>
<html>

<body style="
background:#121212;
color:white;
font-family:Arial;
text-align:center;
padding-top:80px;
">

<h2>🎶 Playlist Shuffled</h2>

<a href="${playlistUrl}" target="_blank">
<button style="
padding:14px 30px;
border-radius:30px;
border:none;
background:#1DB954;
color:white;
font-weight:bold;
cursor:pointer;
">
Open Playlist
</button>
</a>

<br><br>

<a href="/" style="color:#aaa;">
Shuffle Another
</a>

</body>

</html>

`);

  } catch (err) {

    console.log("ERROR:", err.response?.data || err.message);

    res.send("Error shuffling");

  }

});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});
