const params = new URLSearchParams(location.search);
const result = params.get('status');

if (result === 'win') {
    document.getElementById('container').innerHTML = `<img draggable="false" src="img/victory-royale.jpg" alt="leetbattle" style="position: absolute; top: 0; left: 0; width: 100%; height: 100vh; object-fit: cover; object-position: center;">`
}
else if (result == 'lose') {
    document.getElementById('container').innerHTML = 
    `<div class="lose-screen">
    <div class="message-wrapper">
      <h2>Eliminated</h2>
      <p>Looks like you need to brush up on your LeetCode skills!</p>
    </div>
  </div>`
}
else if (result == 'forfeit') {
  document.getElementById('container').innerHTML = 
    `<div class="lose-screen">
    <div class="message-wrapper">
      <h2>Your Opponent Forfeit</h2>
      <p>Maybe you'll find a stronger opponent next game.</p>
    </div>
  </div>`
}