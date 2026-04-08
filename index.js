require("dotenv").config();

const express = require("express");
const SpotifyWebApi = require("spotify-web-api-node");

const app = express();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
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

button{
padding:15px 30px;
background:#1DB954;
border:none;
border-radius:30px;
color:white;
font-weight:bold;
cursor:pointer;
}

</style>

</head>

<body>

<div>

<h1>🎧 Shuffle Shuttle</h1>

<a href="/login">
<button>Connect Spotify</button>
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

    spotifyApi.setAccessToken(data.body.access_token);
    spotifyApi.setRefreshToken(data.body.refresh_token);

    res.redirect("/app");

  } catch (err) {

    console.log(err);
    res.send("Login error");

  }

});




// APP UI
app.get("/app", (req, res) => {

  res.send(`

<h2>Shuffle Playlist</h2>

<form action="/shuffle">

<textarea name="playlist" style="width:400px;height:100px;"></textarea>

<br><br>

<button>Shuffle</button>

</form>

`);

});




// SHUFFLE
app.get("/shuffle", async (req, res) => {

  try {

    // refresh token
    const refresh = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(refresh.body.access_token);

    const playlistUrl = req.query.playlist;
    const playlistId = playlistUrl.split("/playlist/")[1].split("?")[0];


    // GET PLAYLIST
    const playlist = await spotifyApi.getPlaylist(playlistId);

    const playlistName = playlist.body.name;
    const playlistDescription = playlist.body.description;


    // GET TRACKS
    let tracks = [];
    let offset = 0;

    while (true) {

      const data = await spotifyApi.getPlaylistTracks(playlistId, {
        offset: offset,
        limit: 100
      });

      tracks = tracks.concat(data.body.items);

      if (data.body.items.length < 100) break;

      offset += 100;

    }


    // EXTRACT URIS
    let uris = tracks
      .filter(t => t.track && t.track.uri)
      .map(t => t.track.uri);


    // SHUFFLE
    uris.sort(() => Math.random() - 0.5);


    // GET USER
    const me = await spotifyApi.getMe();


    // CREATE NEW PLAYLIST
    const newPlaylist = await spotifyApi.createPlaylist(
      me.body.id,
      playlistName,
      {
        description: playlistDescription,
        public: true
      }
    );

    const newPlaylistId = newPlaylist.body.id;


    // ADD TRACKS
    for (let i = 0; i < uris.length; i += 100) {

      await spotifyApi.addTracksToPlaylist(
        newPlaylistId,
        uris.slice(i, i + 100)
      );

    }


    // SUCCESS
    res.send(`

<h2>🎶 Playlist Shuffled</h2>

<a href="https://open.spotify.com/playlist/${newPlaylistId}" target="_blank">
Open Playlist
</a>

<br><br>

<a href="/">Shuffle Another</a>

`);

  } catch (err) {

    console.log(err);
    res.send("Error shuffling");

  }

});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});
