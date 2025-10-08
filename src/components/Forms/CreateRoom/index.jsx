import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useNavigate } from "react-router-dom"
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { ToastContainer, toast } from "react-toastify"
import './index.css'
import { LogIn, Plus, RefreshCcw, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom'

const CreateRoom = ({ setUser, socket }) => {
    const [id, setId] = useState(uuidv4())
    const [name, setName] = useState("")

    function handleCodeGen() {
        let code = uuidv4()
        setId(code);
    }

    const navigate = useNavigate()

    function handleCreateRoom(e) {
        e.preventDefault()
        const userData = {
            name,
            id,
            userId: uuidv4(),
            host: true,
            presenter: true
        }
        setUser(userData)
        navigate(`/${id}`)
        socket.emit('user-joined', userData)
    }

    function handleCopyText(e) {
        e.preventDefault()
        toast.success("Room Code copied");
    }



    return (
        <div className='w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex justify-center items-center p-5'>
            <div className='bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-[slideUp_0.4s_ease-out]'>
                {/* Header */}
                <div className='bg-blue-600 p-8 text-center text-white'>
                    <h1 className='text-2xl font-semibold mb-2'>CREATE ROOM Whiteboard Room</h1>
                    <p className='text-sm opacity-90 leading-relaxed'>Enter your details to create a new room</p>
                </div>

                {/* Form */}
                <form className='p-8' onSubmit={handleCreateRoom}>
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

                        <div className='relative'>
                            <input
                                className='w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-base text-gray-700 bg-gray-50 font-mono tracking-wider transition-all duration-200 outline-none focus:border-blue-600 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)]'
                                id="input"
                                type="text"
                                disabled
                                value={id}
                                placeholder="Generate Room Code"
                            />
                        </div>

                        <div className='flex gap-2 mt-3'>
                            <button
                                className="flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border-2 border-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-blue-100 hover:border-blue-300 hover:shadow-md"
                                type="button"
                                onClick={handleCodeGen}
                            >
                                <RefreshCcw size={16} />
                                Generate New
                            </button>
                            <CopyToClipboard text={id}>
                                <button
                                    onClick={handleCopyText}
                                    className='flex items-center justify-center gap-2 bg-green-50 text-green-600 border-2 border-green-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-green-100 hover:border-green-300 hover:shadow-md'
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    Copy Code
                                </button>
                            </CopyToClipboard>
                        </div>
                        <ToastContainer />
                    </div>

                    <div className='flex gap-3 mt-8'>
                        <Link
                            className="flex-1 bg-slate-50 text-gray-700 border-2 border-gray-200 py-3 px-5 rounded-xl text-base font-medium cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:bg-slate-100 hover:border-blue-600 hover:text-blue-600 hover:-translate-y-0.5 hover:shadow-lg no-underline"
                            to={`/join-room`}
                        >
                            <Plus size={18} />
                            Join Room
                        </Link>
                        <button
                            type="submit"
                            className="flex-1 bg-blue-600 text-white border-none py-3 px-5 rounded-xl text-base font-medium cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(59,130,246,0.4)]"
                        >
                            <LogIn size={18} />
                            Create Room
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateRoom