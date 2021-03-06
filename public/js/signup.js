/* eslint-disable */
import { showAlert } from './alerts';

export const signUp = async (email, username, password,passwordConfirm) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/users/signup',
      data: {
        email,
        name:username,
        password,
        passwordConfirm
      }
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Signed up Succesfuly!');
      window.setTimeout(() => {
        location.assign('/');
      }, 2500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};