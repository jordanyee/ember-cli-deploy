module.exports = function(environment) {
  var ENV = {};

  if (environment === 'development') {
    ENV.build = {
      environment: 'development'
    };
    ENV.store = {
      host: 'localhost',
      port: 6379
    };

    ENV.assets = {
      accessKeyId: '<your-access-key-goes-here>',
      secretAccessKey: '<your-secret-access-key-goes-here>',
      bucket: '<your-bucket-name>'
    };
  }

  if (environment === 'staging') {
    ENV.build = {
      environment: 'production'
    };

    ENV.store = {
      host: 'staging-redis.firstiwaslike.com',
      port: 6379
    };

    ENV.assets = {
      accessKeyId: '<your-access-key-goes-here>',
      secretAccessKey: '<your-secret-access-key-goes-here>',
      bucket: '<your-bucket-name>',
      prefix: '<optional-remote-prefix>'
    };
  }

  return ENV;
}
