/**
 * Stable IcePanel landscape IDs (20-char).
 * New objects/connections from the first namespaced import were remapped —
 * those assigned IDs are the ones used below.
 */
export const ids = {
  domain: 'loeSy4EM1pCrs7xIld3t',
  root: '1SkNtXaSPXFXUs64wv4Y',

  translator: 'BX0rCo6AUc8jJYQLqZtD',
  mobile: 'yrFCjmD5KQrtynJlw3Wq',
  supabase: '4tKe7evzSbWc93zHb6sE',
  powersync: 'PyBcqIY7MlG3oTwv7eOT',

  mobileClient: 'Rj923Bhcm6St1gNqxQoP',
  signInView: 'k66TcWJ7pJkE7VikI93m',
  authProvider: 'NLRWtlyUdiKpFUplKw67',
  supabaseConnector: 'rRiPXhhYK0KHCojJHIZ3',
  powersyncSystem: 'DdoE0IAprqWKL1vdE4Fz',
  powersyncSdk: 'GObuq9SiRJrV9qzOZPxg',
  sqlite: '92SWeBtk93clohljFBO2',
  asyncStorage: 'fk5UgbyexgepAC4Xgsst',

  supabaseAuth: 'ZnOB4NU01kp7LkHO78CG',
  postgres: 'CAWEetEiIxml0lgXhziA',

  website: 'rEgmG1AAr22S0cA7ZqAe',

  diagramMobileAuth: 'hoVkNrL5KcZdzoiH2Z98',
  flowAuthHappyPath: 'oDSniqGMBCM6LVL6ts9G'
} as const;

export const conn = {
  translatorUsesMobile: 'I4xcopOnu1Yqer3sk1nD',
  translatorSubmitsSignIn: 'NNt5aS9IFAwMTks1bs3D',
  signInCallsConnector: 'jKlbPnRRMQaeckmZG3WI',
  connectorAuthPassword: 'FD0VubYfKkyBH6ZQ07Qc',
  authReturnsSession: 'YApJigxkM6KSwW6idtiv',
  connectorPersistsSession: 'ZkBtiRloK5G9q7ihjcVf',
  authNotifiesProvider: 'JOS0lSdU06K7Lz4wIjNu',
  providerInitsSystem: 'h5KPJaSlTwginadads4P',
  systemConnectsSdk: 'UC40gSM8x4XzqwLBSGn1',
  sdkFetchesJwt: '1eNWWnmVn6oCt3MwK4FZ',
  sdkSyncsPowersync: 'SK14zqOjt7CKVHnckFmw',
  sdkUsesSqlite: 'Fi9PavlYVOTpllyBDtTu',
  powersyncReplicates: 'z49aFYLkfAT3JsLlVRfa',
  mobileAuthenticates: 'ebwsXubW8AwNFy5PH2vE',
  websiteManagesApi: '8C19e8Rf33BKSSwriKSu',
  mobileDirectSyncRemoved: 'Hhc7QIQVbJ5QizhwZy02'
} as const;
