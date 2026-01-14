// // const routes = require("express").Router();
// // const { Ollama } = require("ollama"); // <-- destructure Ollama class

// // const ollama = new Ollama(); // <-- create instance

// // routes.post("/chat", async (req, res) => {
// //   try {
// //     const input = req.body.messages[0].content; // make sure messages is an array
// //     const response = await ollama.chat({
// //       model: "llama3:latest",
// //       messages: [{ role: "user", content: input }],
// //     });
// //     console.log(response);
// //     res.status(200).json({ status: "success", result: response });
// //   } catch (error) {
// //     console.error(error);
// //     res.status(500).json({
// //       status: "error",
// //       error: error.message,
// //     });
// //   }
// // });

// // module.exports = routes;


// const routes = require("express").Router();
// const { Ollama } = require("ollama");
// const { sequelize } = require('../../models/'); // your Sequelize instance

// const ollama = new Ollama();

// routes.post("/queryDB", async (req, res) => {
//   try {
//     const userInput = req.body.prompt;

//     // 1️⃣ Ask Ollama to generate SQL
//     const sqlGenResponse = await ollama.chat({
//       model: "llama3:latest",
//       messages: [
//         { role: "system", content: "You are an expert SQL generator for a PostgreSQL database. Only generate SELECT queries, there should be a well defined query in your response starting with Query: at the end of your response for ease of access." },
//         { role: "user", content: userInput },
//       ],
//     });

//     console.log(sqlGenResponse)

//     const sqlQuery = sqlGenResponse.message.content.split("Query:")[1].trim();
//     console.log("Generated SQL:", sqlQuery);

//     // 2️⃣ Validate SQL (simple check)
//     if (!sqlQuery.toLowerCase().startsWith("select")) {
//       return res.status(400).json({ status: "error", error: "Only SELECT queries are allowed!" });
//     }


//     // 3️⃣ Execute safely
//     const [results] = await sequelize.query(sqlQuery);

//     const sqlResponse = await ollama.chat({
//       model: "llama3:latest",
//       messages: [
//         { role: "system", content: "Here is the response to your earlier query, make it more user friendly and reply with the asked question" },
//         { role: "sql", content: results },
//         { role: "user", content: userInput },
//       ],
//     });

//     res.json({ status: "success", sqlResponse, results });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ status: "error", error: error.message });
//   }
// });

// module.exports = routes;

const routes = require("express").Router();
const { Ollama } = require("ollama");
const { sequelize } = require("../../models/"); // Sequelize instance

const ollama = new Ollama();

// Define a tool for executing SQL queries safely
const tools = [
  {
    type: "function",
    function: {
      name: "run_sql_query",
      description: "Executes a SQL SELECT query on the database and returns the results",
      parameters: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "The SQL SELECT query to execute" },
        },
      },
    },
  },
];

// Helper function to safely run SELECT queries
async function executeSQL(query) {
  if (!query.toLowerCase().startsWith("select")) {
    throw new Error("Only SELECT queries are allowed!");
  }
  const [results] = await sequelize.query(query);
  return JSON.stringify(results); // return as string for the AI
}

routes.post("/chatDB", async (req, res) => {
  try {
    const userInput = req.body.prompt;

    // Conversation history
    const messages = [
      {
        role: "system",
        content: `You are an expert SQL generator for a PostgreSQL database. Use the 'run_sql_query' tool to query the database. Only generate SELECT queries. If you have enough information, respond directly without calling the tool.`
      },
      { role: "user", content: userInput }
    ];

    // 1️⃣ Ask AI
    let response = await ollama.chat({
      model: "qwen3-vl:2b",
      messages,
      tools,
      think: false,
    });

    messages.push(response.message);

    // 2️⃣ Check if AI called a tool
    while (response.message.tool_calls?.length) {
      const call = response.message.tool_calls[0]; // only single tool call assumed
      const args = call.function.arguments;

      // Run the SQL tool
      const toolResult = await executeSQL(args.query);

      // Add tool result to conversation
      messages.push({
        role: "tool",
        tool_name: call.function.name,
        content: toolResult,
      });

      // Ask AI again for next step or final answer
      response = await ollama.chat({
        model: "qwen3-vl:2b",
        messages,
        tools,
        think: false,
      });

      messages.push(response.message);
    }

    // 3️⃣ Return AI final answer
    res.json({ status: "success", response: response.message.content });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", error: error.message });
  }
});

module.exports = routes;

