import { useEffect, useState } from 'react';

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        try {
          const parsed = JSON.parse(data.output || '[]');
          setTasks(parsed);
        } catch {
          setTasks([]);
        }
      });
  }, []);

  const viewTask = id => {
    fetch(`/api/tasks?id=${id}`)
      .then(res => res.json())
      .then(data => {
        try {
          setSelected(JSON.parse(data.output));
        } catch {
          setSelected(null);
        }
      });
  };

  const handleSubmit = e => {
    e.preventDefault();
    const command = `add_task \"${title}\" \"${description}\"`;
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    }).then(() => {
      setTitle('');
      setDescription('');
      // Refresh task list
      fetch('/api/tasks')
        .then(res => res.json())
        .then(data => {
          try {
            setTasks(JSON.parse(data.output || '[]'));
          } catch {
            setTasks([]);
          }
        });
    });
  };

  return (
    <div>
      <h1>Tasks</h1>
      <ul>
        {tasks.map(task => (
          <li key={task.id} onClick={() => viewTask(task.id)} style={{cursor:'pointer'}}>
            {task.title || task.name}
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <h2>Task {selected.id}</h2>
          <p>{selected.title}</p>
          <p>{selected.description}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{marginTop:'1rem'}}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
        />
        <br />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description"
        />
        <br />
        <button type="submit">Add Task</button>
      </form>
    </div>
  );
}
