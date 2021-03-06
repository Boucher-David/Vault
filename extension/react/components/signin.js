import React from 'react';
import {renderIf} from '../lib/__';
import { log } from 'util';
import superagent from 'superagent';

class Signin extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      username: '',
      email: '',
      password: '',
      error: null,
      message: ''
    };
  }

  handleChange = (e) => {

    let {name, value} = e.target;
    this.setState({[name]:value});
  }

  handleSubmit = (e) => {
    e.preventDefault();

    let credentials = {};
    credentials['email'] = this.state.email;
    credentials['password'] = this.state.password;
    credentials['username'] = this.state.username;
    let _string = JSON.stringify(credentials);

    superagent.post('http://vault-extension.herokuapp.com/profile/signin').set('Authorization', `Basic ${btoa(_string)}`).then(response => {

    if (!response.body.signin) {
        this.setState({error: true, message: 'Login Failed.'})
      } else {
        chrome.runtime.sendMessage({'saveID': response.body.user}, res => {
          chrome.runtime.sendMessage({'saveLogins': response.body.logins});
          console.log('here');
          this.props.toggle('unlock');
        });

      }
    });
  }

  back = (e) => {
    e.preventDefault();
    this.props.toggle("home");
  }

  render() {

    let username =
                <label htmlFor='username'>
                  <span>Username</span>
                  <input
                    type='text'
                    name='username'
                    placeholder='username'
                    value={this.state.username}
                    required='true'
                    onChange={this.handleChange}
                   />
                </label>

    let password =
                <label htmlFor='password'>
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    placeholder="password"
                    value={this.state.password}
                    required="true"
                    onChange={this.handleChange}
                    />
                </label>

    let email = <label htmlFor='email'>
    <span>Email</span>
    <input
      type="email"
      name="email"
      placeholder="email"
      value={this.state.email}
      required="true"
      onChange={this.handleChange}
      />
  </label>


    return (
      <div className="signup">
        <form onSubmit={this.handleSubmit}>
          <h2 className="heading">Welcome Back!</h2>

          {username}
          {password}
          {email}

          <button type='submit'>Login</button>
          <button onClick={this.back}>Back</button>
        </form>


      </div>
    )

  }
}

export default Signin;
