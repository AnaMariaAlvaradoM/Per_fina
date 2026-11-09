// El servidor corre en UTC, pero la app se usa en Colombia.
// Estas funciones calculan "hoy" y los límites de un mes en hora de Colombia,
// para que un gasto registrado a las 8 p. m. no quede con fecha del día siguiente.

const TZ = 'America/Bogota';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

// 'YYYY-MM-DD' de hoy en Colombia
const today = () => formatter.format(new Date());

// 'YYYY-MM' del mes actual en Colombia
const currentMonth = () => today().slice(0, 7);

const isValidMonth = (month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month || '');

// Primer y último día de un mes 'YYYY-MM'
const monthBounds = (month) => {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
};

module.exports = { today, currentMonth, isValidMonth, monthBounds };
