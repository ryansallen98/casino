const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const depositForm = document.getElementById('deposit-form');
document.getElementById('casino-loggedin').style.display = 'none';
document.getElementById('casino-login').style.display = 'flex';
document.getElementById('casino-signup-hero').style.display = 'block';
const submitButton = document.getElementById('signup-submit');
submitButton.style.display = 'none';
const nextButton = document.getElementById('signup-next');
const backButton = document.getElementById('signup-back');
let signUpSlide = 1;
console.log(depositForm)
let user;

nextButton.addEventListener('click', () => {
  signUpSlide++;
  if (signUpSlide === 3){
    submitButton.style.display = 'block';
  }
})

backButton.addEventListener('click', () => {
  signUpSlide--;
  if (signUpSlide < 3){
    submitButton.style.display = 'none';
  }
})

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const username = formData.get('username');
  const password = formData.get('password');

  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (response.ok) {
    const { token } = await response.json();

    // Store the token in a cookie or local storage
    document.cookie = `token=${token}; path=/`;

    // Redirect to the home page
    window.location.href = '/';
  } else {
    const { error } = await response.json();

    // Display an error message to the user
    const errorElement = document.querySelector('#login-error');
    errorElement.textContent = error;
  }
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(signupForm);
  const userData = {};

  // Loop through the form elements and add them to the userData object
  for (let element of formData) {
    userData[element[0]] = element[1];
  }

  // Send the user data to the server
  const response = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });

  if (response.ok) {
    const { token } = await response.json();

    // Store the token in a cookie or local storage
    document.cookie = `token=${token}; path=/`;

    // Redirect to the home page
    window.location.href = '/';
  } else {
    const { error } = await response.json();

    // Display an error message to the user
    const errorElement = document.querySelector('#login-error');
    errorElement.textContent = error;
  }
});

depositForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(depositForm)
  const amount = formData.get('amount');

  const response = await fetch('/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, amount })
  });
  if (response.ok) {
    const { payURL } = await response.json();
    window.location.href = payURL;
  } else {
    const { error } = await response.json();
    // Display an error message to the user
    const errorElement = document.querySelector('#deposit-error');
    errorElement.textContent = error;
  }
});



// Get the token from a cookie or local storage
const tokenCookie = document.cookie.split('; ').find(row => row.startsWith('token='));
const token = tokenCookie ? tokenCookie.split('=')[1] : undefined;

if (token) {
  // Include the token in the request headers
  const headers = { Authorization: `Bearer ${token}` };

  // Make a request to a protected API endpoint
  fetch('/api/protected', { headers })
    .then(response => {
      if (response.ok) {
        // The token is valid, so display some protected data
        return response.json();
      } else {
        // The token is invalid, so redirect to the login page
        window.location.href = '/error';
      }
    })
    .then(data => {
      // Display the protected data to the user
      console.log(data);
      document.getElementById('casino-loggedin').style.display = 'flex';
      document.getElementById('casino-login').style.display = 'none';
      document.getElementById('casino-signup-hero').style.display = 'none';
      document.getElementById('balance').innerHTML = (data.user.mainBalance + data.user.bonusBalance) + '.00';
      document.getElementById('main-balance').innerHTML = data.user.mainBalance + '.00';
      document.getElementById('bonus-balance').innerHTML = data.user.bonusBalance + '.00';
      document.getElementById('username-ac').innerHTML = data.user.username;
      document.getElementById('first-name-ac').innerHTML = data.user.firstname;
      document.getElementById('last-name-ac').innerHTML = data.user.lastname;
      document.getElementById('email-ac').innerHTML = data.user.email;
      document.getElementById('address-ac').innerHTML = data.user.address;
      document.getElementById('zipcode-ac').innerHTML = data.user.zipcode;
      document.getElementById('county-ac').innerHTML = data.user.county;
      document.getElementById('state-ac').innerHTML = data.user.state;
      user = data.user.username;
    })
    .catch(error => {
      // Handle any errors that occur during the request
      console.error(error);
    });
} else {
  // The token is not present, so redirect to the login page
  //window.location.href = '/login';
}

// Get the logout button element
const logoutButton = document.getElementById('logout');

// Add a click event listener to the button
logoutButton.addEventListener('click', function () {
  // Remove the "token" cookie
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

  // Redirect the user to the login page
  window.location.href = '/';
});