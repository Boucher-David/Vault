import React from 'react';
// import auth from '../utils/auth';

class Delete extends React.Component {


  handleSubmit(e) {
    e.preventDefault();
      chrome.storage.sync.get('vault', r => {
        // need to write backend method to delete all credentials.
      });

    }

  render() {
    return (
      <form >
          <label>
            <h2>Delete</h2>      
          </label>
          <button onClick={this.handleSubmit}>Delete</button>
          
        </form>
    );
  }
}


export default Delete;