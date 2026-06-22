export default {
  extends: ["@commitlint/config-conventional"],
  prompt: {
    messages: {},
    questions: {
      type: {
        description: "please input type:",
      },
    },
  },
};
