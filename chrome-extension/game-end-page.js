const params = new URLSearchParams(location.search);
const isWin = params.get('status');

if (isWin === 'true') {
    document.getElementById('verdict').innerHTML = 'You Win!';
    document.getElementById('message').innerHTML = 'Calm and collected. You might work for Google some day!';
} else {
    document.getElementById('verdict').innerHTML = 'You Lose!';
    document.getElementById('message').innerHTML = 'Looks like you need to brush up on your leetcode skills.';
}