const { merge } = require('lodash');

const startalterdot = require('@dashevo/dp-services-ctl/lib/services/dashCore/startDashCore');
const startInsightUi = require('./service-ctl/startInsightUI');

async function remove(services) {
  const insightDeps = [
    services.alterdot,
  ];
  await Promise.all(insightDeps.map(instance => instance.remove()));
}

/**
 * @typedef InsightUI
 * @property {DapiCore} insightUi
 * @property {alterdot} alterdot
 * @property {Promise<void>} clean
 * @property {Promise<void>} remove
 */

/**
 * Create Insight UI instance
 *
 * @param {object} [options]
 * @returns {Promise<InsightUI>}
 */
async function startInsightUI(options) {
  const instances = await startInsightUi.many(1, options);
  return instances[0];
}

/**
 * Create Insight UI instances
 *
 * @param {Number} number
 * @param {object} [options]
 * @returns {Promise<InsightUI[]>}
 */
startInsightUI.many = async function many(number, options = {}) {
  if (number < 1) {
    throw new Error('Invalid number of instances');
  }
  if (number > 1) {
    throw new Error("We don't support more than 1 instance");
  }


  const alterdotInstancesPromise = startalterdot.many(number, options.alterdot);
  const [alterdotInstances] = await Promise.all([
    alterdotInstancesPromise,
  ]);

  const instances = [];

  for (let i = 0; i < number; i++) {
    const alterdot = alterdotInstances[i];


    const insightUIOptions = {
      container: {},
      config: {},
      ...options.insightUI,
    };

    merge(insightUIOptions.config, {
      servicesConfig: {
        alterdotd: {
          connect: [{
            rpchost: `${alterdot.getIp()}`,
            rpcport: `${alterdot.options.getRpcPort()}`,
            rpcuser: `${alterdot.options.getRpcUser()}`,
            rpcpassword: `${alterdot.options.getRpcPassword()}`,
            zmqpubrawtx: `tcp://host.docker.internal:${alterdot.options.getZmqPorts().rawtx}`,
            zmqpubhashblock: `tcp://host.docker.internal:${alterdot.options.getZmqPorts().hashblock}`,
          }],
        },
      },
    });


    const insightUIPromise = await startInsightUI(insightUIOptions);

    const [insightUi] = await Promise.all([
      insightUIPromise,
    ]);


    const instance = {
      insightUi,
      alterdot,
      async clean() {
        await remove(instance);

        const newServices = await startInsightUI(options);

        Object.assign(instance, newServices);
      },
      async remove() {
        await remove(instance);
      },
    };

    instances.push(instance);
  }

  return instances;
};

module.exports = startInsightUI;
