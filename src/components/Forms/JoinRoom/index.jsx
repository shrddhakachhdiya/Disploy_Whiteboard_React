import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Link, useNavigate } from "react-router-dom"
import { Users, LogIn, Plus, UserPlus } from 'lucide-react'
import './index.css'

const JoinRoom = ({ setUser, socket }) => {
    const [id, setId] = useState("")//room id
    const [name, setName] = useState("")

    const navigate = useNavigate()

    function handleJoinRoom(e) {
        e.preventDefault()
        if (!name.trim() || !id.trim()) {
            alert("Please fill in all fields")
            return
        }

        const userData = {
            name: name.trim(),
            id: id.trim(),
            userId: uuidv4(),
            host: false,
            presenter: false
        }
        setUser(userData)
        socket.emit('user-joined', userData)
        navigate(`/${id}`)
    }

    function handleClick() {
        console.log("hi")
    }

    return (
        <div className='w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex justify-center items-center p-5'>
            <div className='bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-[slideUp_0.4s_ease-out]'>
                {/* Header */}
                <div className='bg-blue-600 p-8 text-center text-white'>
                    <h1 className='text-2xl font-semibold mb-2'>Join Whiteboard Room</h1>
                    <p className='text-sm opacity-90 leading-relaxed'>Enter your details to join an existing room</p>
                </div>

                {/* Form */}
                <form className='p-8' onSubmit={handleJoinRoom}>
                    <div className='mb-6'>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>Your Name</label>
                        <div className='relative flex items-center'>
                            <UserPlus size={18} className='absolute left-3 text-gray-400 z-10' />
                            <input
                                type="text"
                                className='w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl text-base text-gray-700 bg-gray-50 transition-all duration-200 outline-none focus:border-blue-600 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-400'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                required
                            />
                        </div>
                    </div>

                    <div className='mb-6'>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>Room Code</label>
                        <div className='relative flex items-center'>
                            <Users size={18} className='absolute left-3 text-gray-400 z-10' />
                            <input
                                type="text"
                                className='w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl text-base text-gray-700 bg-gray-50 transition-all duration-200 outline-none focus:border-blue-600 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-gray-400'
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                placeholder="Enter room code"
                                required
                            />
                        </div>
                    </div>

                    <div className='flex gap-3 mt-8'>
                        <Link
                            className="flex-1 bg-slate-50 text-gray-700 border-2 border-gray-200 py-3 px-5 rounded-xl text-base font-medium cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:bg-slate-100 hover:border-blue-600 hover:text-blue-600 hover:-translate-y-0.5 hover:shadow-lg no-underline"
                            to='/'
                        >
                            <Plus size={18} />
                            Create Room
                        </Link>
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 text-white border-none py-3 px-5 rounded-xl text-base font-medium cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(59,130,246,0.4)]"
                        >
                            <LogIn size={18} />
                            Join Room
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default JoinRoom