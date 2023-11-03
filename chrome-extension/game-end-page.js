const params = new URLSearchParams(location.search);
const isWin = params.get('status');

if (isWin === 'true') {
    document.getElementById('container').innerHTML = `<img draggable="false" src="img/victory-royale.jpg" alt="leetbattle" style="position: absolute; top: 0; left: 0; width: 100%; height: 100vh; object-fit: cover; object-position: center;">`
} else {
    document.getElementById('container').innerHTML = 
    `<div class="lose-screen">
    <div class="message-wrapper">
      <h2>Eliminated</h2>
      <p>Looks like you need to brush up on your LeetCode skills!</p>
    </div>
  </div>`
}