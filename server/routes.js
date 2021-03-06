const express = require('express');
const app = module.exports = express.Router();
const authHeader = require('./lib/authHeader.js');
const User = require('./schema/User');
const Credential = require('./schema/Credential');
const emailVerify = require('./lib/email');
const to = require('./lib/to.js');
const security = require('./lib/security.js');

const userHelper = require('./lib/userHelper');
const credentialHelper = require('./lib/credentialHelper');
const bcrypt = require('bluebird').promisifyAll(require('bcrypt'));
var bodyParser = require('body-parser')

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.body = res.body || {};
    res.body.vault = res.body.vault || {};
    return next();
});

app.use(authHeader);

app.post('/profile/signup', async (req, res, next) => {

    res.body = res.body || {};
    res.body.vault = res.body.vault || {};
    res.body.vault.signup = false;

    let credentials = req.body.vault.auth.basic; 

    const newUser = new User({
        username: credentials.username,
        email: credentials.email,
        password: credentials.password
    });

    let [err, user] = await to(userHelper.findUser({username: credentials['username']}));
 
    [err, email] = await to(userHelper.findUser({email: credentials['email']}));

    if (err) return res.send(res.body);
   
    [err, _hash] = await to(newUser.hashPassword(newUser['password']));

    newUser.password = _hash.password;
    newUser.user_id = _hash.user_id;
    newUser.verified = false;
    newUser.verifyCode = _hash.verifyCode;
  
    [err, _save] = await to(newUser.save());

    if (err) return res.send(res.body);
    
    [err, verify] = await to(emailVerify(newUser.email, newUser.verifyCode));
    console.log('error:', err);
    if (err) User.findOneAndRemove({username: credentials.username});

    if (err) return res.send(res.body);

    res.body.vault.signup = true;
    res.send(res.body);
});

app.post('/profile/signin', async (req, res, next) => {
    let credentials = req.body.vault.auth.basic;
    res.body = res.body || {};
    res.body.vault = res.body.vault || {};
    res.body.vault.signin = false;

    [err, user] = await to(userHelper.findUser({username: credentials['username']}));

    if (err) return res.send(res.body.vault);

    [err, email] = await to(userHelper.findUser({email: credentials['email']}));

    if (err) return res.send(res.body.vault);

    [err, password] = await to(userHelper.compare(credentials['password'], user.password));

    if (!password) return res.send(res.body.vault);

    [err, credential] = await to(credentialHelper.findCredential(user.user_id));

    if (err) return res.send(res.body.vault);

    res.body.vault = {
        signin: true,
        user: user.user_id,
        logins: user.logins
    }

    return res.send(res.body.vault);

});

app.post('/profile/update/email', async (req, res, next) => {
    res.body.vault.update = false;
    if (!req.body.vault.auth.basic) return res.send("Done");
    let credentials = req.body.vault.auth.basic;

    [err, user] = await to(userHelper.findUser({user_id: credentials.user_id}));
    [err, email] = await to(userHelper.findUser({email: credentials.oldEmail}));
    [err, update] = await to(User.findOneAndUpdate(
        {user_id: credentials.user_id},
        {$set: {email: credentials.newEmail}},
        {new: true}
    ));

    if (!err) res.body.vault.update = true;
    return res.send(res.body.vault);

});

app.post('/profile/update/password', async (req, res, next) => {
    let credentials = req.body.vault.auth.basic || false;
    if (!credentials) {
        res.body.vault = {
            update: false
        }
        res.send(res.body.vault);
        return next();
    }

    this._findUser = await userHelper.findUser({user_id: credentials.user_id});
    if (!this._findUser) {
        res.body.vault = {
            update: false
        }
        res.send(res.body.vault);
        return next();
    }

    this._verify = await userHelper.compare(credentials.oldPassword, this._findUser.password);
    
    if (!this._verify) {
        res.body.vault = {
            update: false
        }
        res.send(res.body.vault);
        return next();
    }
    let newPassword = await bcrypt.hashAsync(credentials.newPassword, 10);
    let updatedUser = await User.findOneAndUpdate({user_id: credentials.user_id},{$set: {password: newPassword}},{new: true});

    res.body.vault = {
        update: true
    };
    res.send(res.body.vault);
    return next();
});


app.get('/verify/:id', async (req, res, next) => {
    let verifyUser = await userHelper.verifyCheck(req.params.id);

    res.body.vault.verified = verifyUser;
    if (!verifyUser) return res.send(res.body);

    let _user = await userHelper.findUser({verifyCode: req.params.id});

    let _credentials = await credentialHelper.findCredential({user_id: _user.user_id});

    if (!_credentials) {

        let newCredential = new Credential({user_id: _user.user_id, logins: {}});

        let [err, saved] = await to(newCredential.save());


    }
    res.body.vault.verified = true;
    res.send(res.body);

});

app.post('/credential/set',async (req, res, next) => {
    res.body.vault.saved = false;   

    if (!req.body.vault.auth || !req.body.vault.auth.basic.user_id) return res.send("Done");

    [err, user] =  await to(userHelper.findUser({user_id: req.body.vault.auth.basic.user_id}));
  
    if (err) return res.send(res.body);

    [err, credential] = await to(credentialHelper.findCredential(user._user_id));
   
    if (err) return res.send(res.body);

    let newCredentialList = credential.logins;
    let encrypted = await security.encrypt(req.body.vault.auth.basic.credentials);
    // enrypt here

    newCredentialList[req.body.vault.auth.basic.nickname] = encrypted;


    [err, saved] = await to(Credential.findOneAndUpdate(
        {user_id: req.body.vault.auth.basic.user_id},
        {$set: {logins: newCredentialList}},
        {new: true}
    ));


    if (err) return res.send(res.body);

    let savedLogins = Object.keys(saved.logins);


    [err, user] = await to(User.findOneAndUpdate(
        {user_id: req.body.vault.auth.basic.user_id},
        {$set: {logins: savedLogins}},
        {new: true}
    ));


    res.body.vault.logins = user.logins || null;
    res.body.vault.saved = true;

    return res.send(res.body);

});

app.get('/credential/get/:cred', async (req, res, next) => {
    res.body.vault.success = false;

    if (!req.body.vault.auth || !req.body.vault.auth.basic.user_id || !req.params.cred) return res.send("Done");

    [err, user] =  await to(userHelper.findUser({user_id: req.body.vault.auth.basic.user_id}));
    if (err) return res.send(res.body);

    [err, credential] = await to(credentialHelper.findCredential(user._user_id));
    if (err) return res.send(res.body);

    let decrypted = await security.decrypt(credential.logins[req.params.cred]);

    res.body.vault = {
        success: true,
        credential: decrypted
    }
    return res.send(res.body);

});

app.delete('/credential/delete/:cred', async (req, res, next) => {
    res.body.vault = {
        deleted: false
    }
    let [err, user] = await to(userHelper.findUser({user_id: req.body.vault.auth.basic.user_id})) || [err, user];
    [err, credential] = await to(credentialHelper.findCredential(user._user_id));

    if (err) return res.send(res.body);

    if (!credential.logins[req.params.cred]) return res.send(res.body);
    let newCredentialLoginList = {...credential.logins};
    delete newCredentialLoginList[req.params.cred];

    let filteredLogins = user.logins.filter(credential => credential !== req.params.cred);

    [err, updatedUser] = await to(User.findOneAndUpdate(
        {user_id: user.user_id},
        {$set: {logins: filteredLogins}},
        {new : true}
    ));
    if (err) return res.send(res.body);
    [err, updatedCredential] = await to(Credential.findOneAndUpdate(
        {user_id: credential.user_id},
        {$set: {logins: newCredentialLoginList}},
        {new: true}
    ));
    if (err) return res.send(res.body);
    res.body.vault = {
        deleted: true,
        logins: updatedUser.logins
    }


    return res.send(res.body);
});

app.delete('/credential/reset' , async (req, res, next) => {

    res.body.vault = {
        deleted: false
    };

    let [err, user] = await to(userHelper.findUser({user_id: req.body.vault.auth.basic.user_id})) || [err, user];
    [err, credential] = await to(credentialHelper.findCredential(user._user_id));

    if (err) return res.send(res.body);

    [err, updatedUser] = await to(User.findOneAndUpdate(
        {user_id: user.user_id},
        {$set: {logins: []}},
        {new : true}
    ));

    [err, updatedCredential] = await to(Credential.findOneAndUpdate(
        {user_id: credential.user_id},
        {$set: {logins: {}}},
        {new: true}
    ));

    if (err) return res.send(res.body);

    res.body.vault.deleted = true;
    res.body.vault.logins = [];

    return res.send(res.body);

});

app.get('/*', async (req, res, next) => {
    res.send("testing");
    next();
});