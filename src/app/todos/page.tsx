import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Lista de Todos</h1>
      <ul className="space-y-2">
        {todos?.map((todo: any) => (
          <li key={todo.id} className="p-3 bg-slate-800 rounded border border-slate-700 text-white">
            {todo.name || todo.title || JSON.stringify(todo)}
          </li>
        ))}
      </ul>
      {(!todos || todos.length === 0) && (
        <p className="text-slate-400 text-sm">Nenhum todo encontrado ou tabela vazia.</p>
      )}
    </div>
  )
}
