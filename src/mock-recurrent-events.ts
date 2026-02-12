import express from 'express';

const app = express();
const port = 3001;

const mockEvents = [
  {
    id: 1,
    day: 1,
    month: 1,
    name: "New Year's Day",
    description: "Celebration of the beginning of the new year."
  },
  {
    id: 2,
    day: 14,
    month: 2,
    name: "Valentine's Day",
    description: "A day to celebrate love and affection."
  },
  {
    id: 3,
    day: 17,
    month: 3,
    name: "St. Patrick's Day",
    description: "Cultural and religious celebration held on 17 March."
  },
  {
    id: 4,
    day: 1,
    month: 5,
    name: "Labour Day",
    description: "International Workers' Day."
  },
  {
    id: 5,
    day: 31,
    month: 10,
    name: "Halloween",
    description: "A celebration observed in many countries on 31 October."
  },
  {
    id: 6,
    day: 25,
    month: 12,
    name: "Christmas Day",
    description: "Annual festival commemorating the birth of Jesus Christ."
  }
];

app.get('/occurrences', (req, res) => {
  console.log(`[Mock Server] GET /occurrences - Returning ${mockEvents.length} events`);
  res.json(mockEvents);
});

app.listen(port, () => {
  console.log(`Mock recurrent events server listening at http://localhost:${port}`);
});
