firebase.initializeApp(firebaseConfig);  // config from config.js

function initApp() {
  firebase.auth().onAuthStateChanged(user => {
    const signInButton = document.getElementById('signInButton');
    if (user) {
      signInButton.innerText = 'Sign Out';
      document.getElementById('form').style.display = '';
    } else {
      signInButton.innerText = 'Sign In with Google';
      document.getElementById('form').style.display = 'none';
    }
  });
}

function authDisabled() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('auth') === 'false' && window.location.hostname === 'localhost';
}

async function createIdToken() {
  if (authDisabled()) {
    console.warn('Auth is disabled. Returning dummy ID token.');
    return 'dummyToken';
  } else {
    return await firebase.auth().currentUser.getIdToken();
  }
}

function signIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  firebase.auth().signInWithPopup(provider)
    .then(result => {
      console.log(`${result.user.displayName} logged in.`);
      window.alert(`Welcome ${result.user.displayName}!`);
    })
    .catch(err => {
      console.log(`Error during sign in: ${err.message}`);
      window.alert(`Sign in failed. Retry or check your browser logs.`);
    });
}

function signOut() {
  firebase.auth().signOut().catch(err => {
    console.log(`Error during sign out: ${err.message}`);
    window.alert(`Sign out failed. Retry or check your browser logs.`);
  });
}

function toggle() {
  if (authDisabled()) {
    window.alert('Auth is disabled.');
    return;
  }
  if (!firebase.auth().currentUser) {
    signIn();
  } else {
    signOut();
  }
}

window.onload = function () {
  const signInButton = document.getElementById('signInButton');
  signInButton.addEventListener('click', toggle);

  const voteTabs = document.getElementById('voteTabs');
  const voteSpaces = document.getElementById('voteSpaces');

  if (voteTabs) {
    voteTabs.addEventListener('click', () => handleVote("TABS", voteTabs));
  }
  if (voteSpaces) {
    voteSpaces.addEventListener('click', () => handleVote("SPACES", voteSpaces));
  }

  if (authDisabled()) {
    console.warn('Running with auth disabled.');
    signInButton.innerText = '(Auth Disabled)';
    document.getElementById('form').style.display = '';
  } else {
    console.log('Running with auth enabled.');
    initApp();
  }
};

// Handles vote + disables button to prevent duplicate submissions
async function handleVote(team, buttonElement) {
  if (buttonElement.disabled) return;

  buttonElement.disabled = true;
  await vote(team);
  buttonElement.disabled = false;
}

async function vote(team) {
  console.log(`Submitting vote for ${team}...`);
  const voteTabs = document.getElementById('voteTabs');
  const voteSpaces = document.getElementById('voteSpaces');

  // Disable buttons to prevent multiple submissions
  voteTabs.disabled = true;
  voteSpaces.disabled = true;

  if (firebase.auth().currentUser || authDisabled()) {
    try {
      const token = await createIdToken();

      const response = await fetch("/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${token}`,
        },
        body: new URLSearchParams({ team: team }).toString(),
      });

      if (response.ok) {
        console.log("Vote submitted successfully.");
        window.history.replaceState(null, null, window.location.pathname);
        window.location.reload();
      } else {
        throw new Error("Vote failed.");
      }
    } catch (err) {
      console.error("Error submitting vote:", err);
      window.alert("Something went wrong when submitting your vote.");
    } finally {
      // Re-enable buttons after the process completes
      voteTabs.disabled = false;
      voteSpaces.disabled = false;
    }
  } else {
    window.alert("User not signed in.");
    // Re-enable buttons if user is not signed in
    voteTabs.disabled = false;
    voteSpaces.disabled = false;
  }
}
