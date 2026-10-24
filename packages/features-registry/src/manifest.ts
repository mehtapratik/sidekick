/**
 * A feature’s metadata
 */
export interface FeatureManifest {
   /**
    * The unique identifier for the feature - lowercase, hyphenated.
    *
    * CAUTION: Once set, never change it, as it is used to map user's access to the feature.
    */
   readonly key: string;
   /**
    * The human-readable name of the feature.
    */
   readonly name: string;
   /**
    * The human-readable description of the feature.
    */
   readonly description: string;
}
