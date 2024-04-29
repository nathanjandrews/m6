// eslint-disable-next-line no-unused-vars
const TYPES = require('../../util/types');

/** @typedef {Omit<TYPES.NodeConfig, 'onStart'>} NodeConfig */
/** @typedef {TYPES.GroupConfig} GroupConfig */
/** @typedef {TYPES.GroupsToNodeMapping} GroupsToNodeMapping */
/** @typedef {TYPES.ServiceCallback<any, any>} ServiceCallback */

const {id} = require('../../util');
const localMrService = require('../../local/services/mr');
/**
 * Map-Reduce Service Template
 * @param {GroupConfig} config
 * @return {object}
 */
const mr = (config) => {
  const context = {
    gid: config.gid || 'all',
  };

  return {
    /**
     * Map-Reduce EXEC method template
     * @template T
     * @param {TYPES.MapReduceConfiguration<T>} mrConfig
     * @param {ServiceCallback} callback
     */
    exec: (mrConfig, callback) => {
      const cb = callback || function() {};
      const configuration = {
        ...mrConfig,
        memory: mrConfig.memory || false,
        compact: !!mrConfig.compact,
      };

      // For the setup phase, this coordinator must create a set of dynamic and
      // ephemeral service endpoints corresponding to this invocation of map
      // reduce. These endpoints must be removed after the reduce phase
      // completes
      const groupServices = global.distribution[context.gid];

      // constructing the "local" mr service to be instantiated on all nodes in
      // the group
      const mrServiceName = `mr-${id.getRID()}`;
      /**
       * @type {TYPES.LocalMapReduceContext}
       */
      const localMapReduceContext = {
        gid: context.gid,
        serviceName: mrServiceName,
        memory: configuration.memory,
        storeGid: configuration.storeGid || context.gid,
        loadGid: configuration.loadGid || context.gid,
        compact: configuration.compact,
        noShuffle: configuration.noShuffle || false,
        reduceStore: configuration.reduceStore || false,
      };

      groupServices.routes.put(localMrService, mrServiceName, (e, v) => {
        if (Object.keys(e).length > 0) {
          console.error('route instantiation:', e);
          return cb(e);
        }

        // at this point we have added the localMrService to all of the nodes
        // in this group. Now we need to begin the mapping phase.
        groupServices.comm.send(
            [localMapReduceContext, configuration.keys, configuration.map],
            {service: mrServiceName, method: 'map'},
            (e, v) => {
              if (Object.keys(e).length > 0) {
                console.error('mr map:', e);
                return cb(e);
              }
              if (configuration.noShuffle) {
                return cb(null, v);
              }

              // at this point we know that all of the nodes have completed the
              // map phase. Now we need to shuffle and group the data
              groupServices.comm.send(
                  [localMapReduceContext, configuration.keys, id.consistentHash],
                  {service: mrServiceName, method: 'shuffle'},
                  (e, v) => {
                    if (Object.keys(e).length > 0) {
                      if (Object.values(e)[0].message.includes('not yet supported')) {
                        return cb(null);
                      } else {
                        console.error('mr shuffle & group:', e);
                        return cb(e);
                      }
                    }

                    // at this point we know that all of the nodes have
                    // completed the shuffle and group phases. We now need to
                    // reduce the data.
                    groupServices.comm.send(
                        [localMapReduceContext, configuration.reduce],
                        {service: mrServiceName, method: 'reduce'},
                        (e, v) => {
                          if (Object.keys(e).length > 0) {
                            console.error('mr reduce:', e);
                            return cb(e);
                          }

                          // transform the reduced values to the proper form
                          const reductions = Object.values(v).flat();

                          // clean up the "local" Map-Reduce service
                          if (configuration.cleanup) {
                            groupServices.comm.send(
                                [localMapReduceContext],
                                {service: mrServiceName, method: 'cleanup'},
                                () => cb(null, reductions),
                            );
                          } else {
                            cb(null, reductions);
                          }
                        },
                    );
                  },
              );
            });
      });
    },
  };
};

module.exports = mr;
