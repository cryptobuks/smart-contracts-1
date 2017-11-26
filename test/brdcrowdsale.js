var BRDCrowdsale = artifacts.require('BRDCrowdsale');
var BRDToken = artifacts.require('BRDToken');
var BRDCrowdsaleAuthorizer = artifacts.require('BRDCrowdsaleAuthorizer');
var constants = require('../constants.js');

contract('BRDCrowdsale', function(accounts) {
  var c = constants(web3, accounts, 'development');
  var expectedLockupShare = (new web3.BigNumber(accounts.length*6)).mul(c.exponent);

  // resolves to the crowdsale contract that has the second account
  // pre-authorized
  function secondAccountAuthorized() {
    var crowdsale;
    var authorizer;
    return BRDCrowdsale.deployed().then(function (instance) {
      crowdsale = instance;
      return instance.authorizer.call();
    }).then(function(authorizerAddr) {
      authorizer = BRDCrowdsaleAuthorizer.at(authorizerAddr);
      return authorizer.authorizeAccount(accounts[1], {from: accounts[0]});
    }).then(function() {
      return authorizer.isAuthorized.call(accounts[1], {from: accounts[1]}).then(function(isAuthorized) {
        assert(isAuthorized, '2nd account must be authorized');
        return crowdsale;
      });
    }).catch(function(err) {
      console.log(err);
      assert(false, 'error authorizing account');
    });
  }

  // waits until the crowdsale start time to resolve with the
  // provided crowdsale
  function awaitStartTime(crowdsale) {
    return new Promise(function(resolve, _) {
      var nowTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
      var startTime = c.startTime - nowTime;
      setTimeout(function() {
        resolve(crowdsale);
      }, startTime*1000);
    });
  }

  it('should award the owner share upon contract creation', function() {
    return BRDCrowdsale.deployed().then(function(instance) {
      return instance.token.call().then(function(tokenAddr) {
        var token = BRDToken.at(tokenAddr);
        return token.balanceOf.call(accounts[0]);
      });
    }).then(function(balance) {
      assert(balance.eq(c.ownerShare));
    });
  });

  it('should allocate the lockup tokens upon contract creation', function() {
    return BRDCrowdsale.deployed().then(function(instance) {
      return instance.token.call().then(function(tokenAddr) {
        var token = BRDToken.at(tokenAddr);
        return token.balanceOf.call(instance.address);
      });
    }).then(function(balance) {
      assert(balance.eq(expectedLockupShare), 'expected lockup share does not match');
    });
  });

  it('should set the contract owner as the initial authorizer', function() {
    return BRDCrowdsale.deployed().then(function(instance) {
      return instance.authorizer.call().then(function(authorizerAddr) {
        var authorizer = BRDCrowdsaleAuthorizer.at(authorizerAddr);
        return authorizer.isAuthorizer.call(accounts[0]);
      });
    }).then(function(contractCreatorIsAuthorizer) {
      assert(contractCreatorIsAuthorizer);
    });
  });

  it('should not allow contributions less than the minimum', function() {
    var amountToSend = c.minContribution.div(2); // .5 ETH
    return awaitStartTime(secondAccountAuthorized()).then(function(instance) {
      return instance.sendTransaction({from: accounts[1], value: amountToSend});
    }).then(function() {
      assert(false, 'should have reverted');
    }).catch(function(err) {
      assert((new String(err)).indexOf('revert') !== -1);
    });
  });

  it('should not allow contributions more than the maximum', function() {
    var amountToSend = c.maxContribution.add(1000000000); // 5.000000001 ETH
    return awaitStartTime(secondAccountAuthorized()).then(function(instance) {
      return instance.sendTransaction({from: accounts[1], value: amountToSend});
    }).then(function() {
      assert(false, 'should have reverted');
    }).catch(function(err) {
      assert((new String(err)).indexOf('revert') !== -1);
    });
  });

  it('should not allow contributions from unauthorized accounts', function() {
    return awaitStartTime(BRDCrowdsale.deployed()).then(function(instance) {
      var amountToSend = (new web3.BigNumber(1).mul(c.exponent)); // 1ETH
      return instance.sendTransaction({from: accounts[1], value: amountToSend});
    }).then(function() {
      assert(false, 'should have reverted');
    }).catch(function(err) {
      assert((new String(err)).indexOf('revert') !== -1);
    });
  });

  it('should allow a valid contribution', function() {
    var amountToSend = (new web3.BigNumber(1).mul(c.exponent));
    return awaitStartTime(secondAccountAuthorized()).then(function(instance) {
      return instance.sendTransaction({from: accounts[1], value: amountToSend});
    }).then(function() {
      assert(true);
    }).catch(function(err) {
      console.log(err);
      assert(false, 'no error expected');
    });
  });

  it('should allow duplicate purchases less then the max contribution', function() {
    var amountToSend = (new web3.BigNumber(1).mul(c.exponent));
    var crowdsale;
    return awaitStartTime(secondAccountAuthorized()).then(function(instance) {
      crowdsale = instance;
      return instance.sendTransaction({from: accounts[1], value: amountToSend});
    }).then(function() {
      return crowdsale.sendTransaction({from: accounts[1], value: amountToSend});
    }).then(function() {
      assert(true);
    }).catch(function(err) {
      console.log(err);
      assert(false, 'no error expected');
    });
  });

  it('should not allow contribution before start time', function() {
    var amountToSend = (new web3.BigNumber(1).mul(c.exponent)); // 1ETH
    return secondAccountAuthorized().then(function(instance) {
      return instance.sendTransaction({from: accounts[1], value: amountToSend});
    }).then(function() {
      assert(false, 'should have reverted');
    }).catch(function(err) {
      assert((new String(err)).indexOf('revert') !== -1);
    });
  });
});