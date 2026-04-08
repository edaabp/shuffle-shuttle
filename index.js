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


// LANDING PAGE
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
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
}

button{
padding:15px 30px;
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

<h1>🎧 Shuffle Shuttle</h1>

<p>Shuffle your Spotify playlist instantly</p>

<a href="/login">
<button>Connect Spotify Account</button>
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
    spotifyApi.createAuthorizeURL(scopes, "shuffle-shuttle")
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

<style>

body{
background:#121212;
color:white;
font-family:Arial;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
}

.container{
width:400px;
text-align:center;
}

textarea{
width:100%;
height:100px;
margin-bottom:20px;
padding:10px;
border-radius:10px;
border:none;
}

button{
padding:15px;
background:#1DB954;
border:none;
border-radius:30px;
color:white;
font-weight:bold;
cursor:pointer;
width:100%;
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


    // REFRESH TOKEN
    spotifyApi.setRefreshToken(refreshToken);

    const refresh = await spotifyApi.refreshAccessToken();

    accessToken = refresh.body.access_token;


    const playlistId = playlistUrl.split("/playlist/")[1].split("?")[0];


    // GET TRACKS
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


    // EXTRACT URIS
    let uris = tracks
      .filter(t => t.track && t.track.uri)
      .map(t => t.track.uri);


    // SHUFFLE
    uris.sort(() => Math.random() - 0.5);


    // REMOVE ALL TRACKS
    await axios.delete(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        data: {
          tracks: uris.map(uri => ({ uri }))
        }
      }
    );


    // ADD BACK SHUFFLED TRACKS
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


    // SUCCESS PAGE
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
padding:15px 30px;
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

<a href="/" style="color:#aaa;">Shuffle Another</a>

</body>

</html>

`);

  } catch (err) {

    console.log("ERROR:", err.response?.data || err.message);

    res.send(`
<h2>Error shuffling</h2>
<pre>${JSON.stringify(err.response?.data || err.message, null, 2)}</pre>
`);

  }

});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});
