/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import { useAdminAI as useAdminAILogic } from '../hooks/useAdminAI';

const AdminAIContext = createContext(null);

export const AdminAIProvider = ({ children }) => {
  const advisorState = useAdminAILogic();
  
  return (
    <AdminAIContext.Provider value={advisorState}>
      {children}
    </AdminAIContext.Provider>
  );
};

export const useAdminAI = () => {
  return useContext(AdminAIContext);
};
