const stripeStubSource = `
const state = globalThis.__NOVORIQ_STRIPE_STATE ??= {
  validationCalls: [],
  disputeUpdates: [],
  webhookConstructs: [],
  failDisputeUpdate: false
};

function parseBody(rawBody) {
  const bodyText = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "");
  return JSON.parse(bodyText);
}

export default class Stripe {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = options;
    this.disputes = {
      list: async (params = {}) => {
        state.validationCalls.push({ apiKey, params });

        if (typeof apiKey === "string" && apiKey.startsWith("rk_valid")) {
          return { data: [] };
        }

        if (typeof apiKey === "string" && apiKey.startsWith("rk_perm")) {
          const error = new Error("Restricted key is missing required permissions");
          error.type = "StripePermissionError";
          error.code = "insufficient_permissions";
          throw error;
        }

        const error = new Error("Invalid Stripe restricted API key");
        error.type = "StripeAuthenticationError";
        throw error;
      },
      update: async (disputeId, payload) => {
        state.disputeUpdates.push({ apiKey, disputeId, payload });

        if (state.failDisputeUpdate) {
          const error = new Error("Stripe API is unavailable");
          error.type = "StripeAPIError";
          throw error;
        }

        return {
          id: disputeId,
          object: "dispute",
          evidence: payload?.evidence ?? {}
        };
      }
    };
    this.webhooks = {
      constructEvent: (rawBody, signature, secret, tolerance) => {
        state.webhookConstructs.push({ apiKey, signature, secret, tolerance });

        if (signature !== "valid:" + secret) {
          throw new Error("No signatures found matching the expected signature for payload");
        }

        return parseBody(rawBody);
      }
    };
  }
}
`;

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === "stripe") {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(stripeStubSource)}`
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}
